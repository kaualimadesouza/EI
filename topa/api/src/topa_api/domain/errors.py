"""Business-rule violations. The message is what the customer reads at the kiosk,
so it is pt-BR copy; presentation only picks the HTTP status."""


class DomainError(Exception):
    pass


class EmptyOrderError(DomainError):
    def __init__(self) -> None:
        super().__init__("Adicione pelo menos um produto ao pedido.")


class QuantityOutOfRangeError(DomainError):
    def __init__(self, minimum: int, maximum: int) -> None:
        super().__init__(f"Escolha de {minimum} a {maximum} unidades de cada produto.")


class UnknownProductError(DomainError):
    def __init__(self, product_id: str) -> None:
        super().__init__("Um dos produtos não está mais no cardápio.")
        self.product_id = product_id


class ProductUnavailableError(DomainError):
    def __init__(self, product_name: str) -> None:
        super().__init__(f"{product_name} esgotou.")


class OrderNumberTakenError(DomainError):
    """Another kiosk stored the same number first; worth one retry before the customer sees it."""

    def __init__(self) -> None:
        super().__init__("Não foi possível registrar o pedido. Tente de novo.")
