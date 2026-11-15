import re
import unicodedata
import uuid

from topa_api.application.ports import (
    Clock,
    MerchantRepositoryPort,
    PasswordHasherPort,
    StoreRepository,
    TokenServicePort,
)
from topa_api.domain.auth import AuthenticatedMerchant, AuthToken, Merchant, MerchantRegistration
from topa_api.domain.catalog import Store
from topa_api.domain.errors import EmailAlreadyInUseError, InvalidMerchantDataError


class RegisterMerchantUseCase:
    """Creates the store and its owner in the request's single transaction."""

    def __init__(
        self,
        stores: StoreRepository,
        merchants: MerchantRepositoryPort,
        hasher: PasswordHasherPort,
        tokens: TokenServicePort,
        clock: Clock,
    ) -> None:
        self._stores = stores
        self._merchants = merchants
        self._hasher = hasher
        self._tokens = tokens
        self._clock = clock

    def execute(self, registration: MerchantRegistration) -> AuthToken:
        name = registration.store_name.strip()
        email = registration.email.strip().lower()
        password = registration.password
        if not 2 <= len(name) <= 100:
            raise InvalidMerchantDataError("Informe o nome da loja, com 2 a 100 caracteres.")
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", email):
            raise InvalidMerchantDataError("Informe um e-mail válido.")
        if not 8 <= len(password) <= 128:
            raise InvalidMerchantDataError("Use uma senha de 8 a 128 caracteres.")
        if self._merchants.get_by_email(email) is not None:
            raise EmailAlreadyInUseError()

        merchant_id = uuid.uuid4()
        ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        prefix = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:48].rstrip("-")
        slug = f"{prefix or 'loja'}-{merchant_id.hex[:12]}"
        self._stores.add(Store(slug=slug, name=name, accepting_orders=False))
        merchant = Merchant(merchant_id, email, slug, self._clock.now())
        self._merchants.add(merchant, self._hasher.hash_password(password))
        authenticated = AuthenticatedMerchant(merchant_id, email, slug)
        return AuthToken(self._tokens.create_token(authenticated), "bearer", slug, email)
