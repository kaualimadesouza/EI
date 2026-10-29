import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Merchant:
    id: uuid.UUID
    email: str
    store_slug: str
    created_at: datetime


@dataclass(frozen=True)
class Credentials:
    email: str
    password: str


@dataclass(frozen=True)
class AuthenticatedMerchant:
    id: uuid.UUID
    email: str
    store_slug: str


@dataclass(frozen=True)
class AuthToken:
    access_token: str
    token_type: str
    store_slug: str
    email: str
