import uuid
from collections.abc import Collection
from datetime import date

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from topa_api.adapters.db.models import (
    CustomerRow,
    MerchantRow,
    OrderItemRow,
    OrderRow,
    ProductRow,
    StoreRow,
)
from topa_api.application.ports import CustomerRecord, MerchantRecord
from topa_api.domain.auth import Customer, Merchant
from topa_api.domain.catalog import DEFAULT_STORE_SLUG, Product, Store
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

# namespace of the per-store-day number lock, so it never meets another advisory lock
ORDER_NUMBER_LOCK = 1

# items in a second query, not a join: Postgres refuses FOR UPDATE on an outer join
WITH_ITEMS = selectinload(OrderRow.items).joinedload(OrderItemRow.product)


class SqlAlchemyStoreRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, slug: str) -> Store | None:
        row = self._session.get(StoreRow, slug)
        return None if row is None else Store(slug=row.slug, name=row.name)

    def list_all(self) -> list[Store]:
        rows = self._session.scalars(select(StoreRow).order_by(StoreRow.name))
        return [Store(slug=row.slug, name=row.name) for row in rows]


class SqlAlchemyProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_store(self, store_slug: str) -> list[Product]:
        rows = self._session.scalars(
            select(ProductRow)
            .where(ProductRow.store_slug == store_slug)
            .order_by(ProductRow.position)
        )
        return [_product_of(row) for row in rows]

    def find(self, store_slug: str, product_ids: Collection[str]) -> list[Product]:
        rows = self._session.scalars(
            select(ProductRow).where(
                ProductRow.store_slug == store_slug,
                ProductRow.id.in_(product_ids),
            )
        )
        return [_product_of(row) for row in rows]

    def get(self, store_slug: str, product_id: str) -> Product | None:
        row = self._session.get(ProductRow, (store_slug, product_id))
        return None if row is None else _product_of(row)

    def next_position(self, store_slug: str) -> int:
        highest = self._session.scalar(
            select(func.max(ProductRow.position)).where(ProductRow.store_slug == store_slug)
        )
        return (highest or 0) + 1

    def create(self, store_slug: str, product: Product, position: int) -> Product:
        row = ProductRow(
            store_slug=store_slug,
            id=product.id,
            position=position,
            name=product.name,
            description=product.description,
            category=product.category,
            price_cents=product.price_cents,
            available=product.available,
            photo_url=product.photo_url,
        )
        self._session.add(row)
        self._session.flush()
        return _product_of(row)

    def update(self, store_slug: str, product: Product) -> Product | None:
        row = self._session.get(ProductRow, (store_slug, product.id))
        if row is None:
            return None
        row.name = product.name
        row.description = product.description
        row.category = product.category
        row.price_cents = product.price_cents
        row.available = product.available
        row.photo_url = product.photo_url
        return _product_of(row)

    def set_availability(self, store_slug: str, product_id: str, available: bool) -> Product | None:
        row = self._session.get(ProductRow, (store_slug, product_id))
        if row is None:
            return None
        row.available = available
        return _product_of(row)


SqlAlchemyCatalogRepository = SqlAlchemyProductRepository


class SqlAlchemyOrderRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def next_number(self, store_slug: str, business_date: date) -> int:
        # held to the commit; the max() below then sees the last commit, which needs READ COMMITTED
        if store_slug == DEFAULT_STORE_SLUG:
            # the pre-stores key, so instances still on the old image wait too during a deploy
            self._session.execute(
                select(func.pg_advisory_xact_lock(ORDER_NUMBER_LOCK, business_date.toordinal()))
            )
        lock_key = f"{store_slug}:{business_date.isoformat()}"
        self._session.execute(
            select(func.pg_advisory_xact_lock(func.hashtextextended(lock_key, ORDER_NUMBER_LOCK)))
        )
        highest = self._session.scalar(
            select(func.max(OrderRow.number)).where(
                OrderRow.store_slug == store_slug,
                OrderRow.business_date == business_date,
            )
        )
        return (highest or 0) + 1

    def add(self, order: Order) -> None:
        row = OrderRow(
            id=order.id,
            store_slug=order.store_slug,
            business_date=order.business_date,
            number=order.number,
            status=order.status.value,
            dine_in=order.dine_in,
            payment_method=order.payment_method.value,
            total_cents=order.total_cents,
            created_at=order.created_at,
            customer_id=order.customer_id,
            items=[
                OrderItemRow(
                    store_slug=order.store_slug,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price_cents=item.unit_price_cents,
                )
                for item in order.items
            ],
        )
        self._session.add(row)

    def list_for_day(self, store_slug: str, business_date: date) -> list[Order]:
        rows = self._session.scalars(
            select(OrderRow)
            .where(
                OrderRow.store_slug == store_slug,
                OrderRow.business_date == business_date,
            )
            .order_by(OrderRow.number)
            .options(WITH_ITEMS)
        )
        return [_order_of(row) for row in rows]

    def get(self, order_id: uuid.UUID) -> Order | None:
        row = self._session.get(OrderRow, order_id, options=[WITH_ITEMS])
        return None if row is None else _order_of(row)

    def get_for_update(self, order_id: uuid.UUID) -> Order | None:
        row = self._session.get(OrderRow, order_id, options=[WITH_ITEMS], with_for_update=True)
        return None if row is None else _order_of(row)

    def set_status(self, order_id: uuid.UUID, status: OrderStatus) -> None:
        self._session.execute(
            update(OrderRow).where(OrderRow.id == order_id).values(status=status.value)
        )

    def list_for_customer(self, customer_id: uuid.UUID) -> list[Order]:
        rows = self._session.scalars(
            select(OrderRow)
            .where(OrderRow.customer_id == customer_id)
            .order_by(OrderRow.created_at.desc())
            .options(WITH_ITEMS)
        )
        return [_order_of(row) for row in rows]


def _product_of(row: ProductRow) -> Product:
    return Product(
        id=row.id,
        name=row.name,
        description=row.description,
        category=row.category,
        price_cents=row.price_cents,
        available=row.available,
        photo_url=row.photo_url,
    )


def _order_of(row: OrderRow) -> Order:
    return Order(
        id=row.id,
        store_slug=row.store_slug,
        number=row.number,
        business_date=row.business_date,
        status=OrderStatus(row.status),
        dine_in=row.dine_in,
        payment_method=PaymentMethod(row.payment_method),
        # menu order, the one the kitchen reads; the order the customer tapped is not stored
        items=tuple(
            OrderItem(
                product_id=item.product_id,
                name=item.product.name,
                quantity=item.quantity,
                unit_price_cents=item.unit_price_cents,
            )
            for item in sorted(row.items, key=lambda item: item.product.position)
        ),
        created_at=row.created_at,
        customer_id=row.customer_id,
    )


class SqlAlchemyMerchantRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> MerchantRecord | None:
        row = self._session.scalars(
            select(MerchantRow).where(MerchantRow.email == email.lower().strip())
        ).first()
        if row is None:
            return None
        merchant = Merchant(
            id=row.id,
            email=row.email,
            store_slug=row.store_slug,
            created_at=row.created_at,
        )
        return MerchantRecord(merchant=merchant, password_hash=row.password_hash)

    def add(self, merchant: Merchant, password_hash: str) -> None:
        self._session.add(
            MerchantRow(
                id=merchant.id,
                email=merchant.email.lower().strip(),
                password_hash=password_hash,
                store_slug=merchant.store_slug,
                created_at=merchant.created_at,
            )
        )


class SqlAlchemyCustomerRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> CustomerRecord | None:
        row = self._session.scalars(
            select(CustomerRow).where(CustomerRow.email == email.lower().strip())
        ).first()
        if row is None:
            return None
        customer = Customer(
            id=row.id,
            name=row.name,
            email=row.email,
            created_at=row.created_at,
        )
        return CustomerRecord(customer=customer, password_hash=row.password_hash)

    def get_by_id(self, customer_id: uuid.UUID) -> CustomerRecord | None:
        row = self._session.get(CustomerRow, customer_id)
        if row is None:
            return None
        customer = Customer(
            id=row.id,
            name=row.name,
            email=row.email,
            created_at=row.created_at,
        )
        return CustomerRecord(customer=customer, password_hash=row.password_hash)

    def add(self, customer: Customer, password_hash: str) -> None:
        self._session.add(
            CustomerRow(
                id=customer.id,
                name=customer.name.strip(),
                email=customer.email.lower().strip(),
                password_hash=password_hash,
                created_at=customer.created_at,
            )
        )
