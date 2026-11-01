import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class PaymentStatus(StrEnum):
    """Payment lifecycle status states for Pix charges."""

    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


@dataclass(frozen=True)
class PixCharge:
    """Represents a Pix payment charge issued for an order."""

    id: str
    order_id: uuid.UUID
    amount_cents: int
    status: PaymentStatus
    br_code: str
    br_code_base64: str | None = None
    qr_code_url: str | None = None
    expires_at: datetime | None = None
    created_at: datetime | None = None
