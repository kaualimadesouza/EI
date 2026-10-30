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


@dataclass(frozen=True)
class Customer:
    id: uuid.UUID
    name: str
    email: str
    created_at: datetime


@dataclass(frozen=True)
class CustomerCredentials:
    email: str
    password: str


@dataclass(frozen=True)
class CustomerRegistration:
    name: str
    email: str
    password: str


@dataclass(frozen=True)
class AuthenticatedCustomer:
    id: uuid.UUID
    name: str
    email: str


@dataclass(frozen=True)
class CustomerAuthToken:
    access_token: str
    token_type: str
    name: str
    email: str
