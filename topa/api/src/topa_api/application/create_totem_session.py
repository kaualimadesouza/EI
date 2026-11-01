from dataclasses import dataclass
from datetime import datetime

from topa_api.application.ports import StoreRepository, TokenService
from topa_api.domain.errors import StoreNotFoundError


@dataclass(frozen=True)
class TotemSessionOutput:
    token: str
    store_slug: str
    expires_at: datetime
    url: str


class CreateTotemSessionUseCase:
    """Issues a cryptographically signed temporary session token for a totem."""

    def __init__(
        self,
        token_service: TokenService,
        stores: StoreRepository,
        base_url: str = "https://topa-totem.vercel.app",
    ) -> None:
        self._token_service = token_service
        self._stores = stores
        self._base_url = base_url.rstrip("/")

    def execute(self, store_slug: str, duration_seconds: int = 1800) -> TotemSessionOutput:
        store = self._stores.get(store_slug)
        if store is None:
            raise StoreNotFoundError()
        token = self._token_service.create_totem_session_token(
            store_slug=store_slug, expires_in_seconds=duration_seconds
        )
        session = self._token_service.verify_totem_session_token(token)
        url = f"{self._base_url}/?loja={store_slug}&sessao={token}"
        return TotemSessionOutput(
            token=token,
            store_slug=store_slug,
            expires_at=session.expires_at,
            url=url,
        )
