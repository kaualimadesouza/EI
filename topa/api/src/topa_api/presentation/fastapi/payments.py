import json
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request
from pydantic import BaseModel

from topa_api.application.create_pix_payment import (
    CreatePixPaymentCommand,
    CreatePixPaymentUseCase,
)
from topa_api.application.get_payment_status import GetPaymentStatusUseCase
from topa_api.application.process_payment_webhook import (
    ProcessPaymentWebhookUseCase,
    ProcessWebhookCommand,
)
from topa_api.domain.payment import PixCharge
from topa_api.presentation.fastapi.dependencies import (
    get_abacatepay_webhook_secret,
    get_create_pix_payment_use_case,
    get_payment_status_use_case,
    get_process_payment_webhook_use_case,
)

router = APIRouter(prefix="/payments", tags=["payments"])


class CreatePixPaymentRequest(BaseModel):
    order_id: uuid.UUID
    description: str | None = None


class PixPaymentResponse(BaseModel):
    id: str
    order_id: uuid.UUID
    amount_cents: int
    status: str
    br_code: str
    br_code_base64: str | None = None
    qr_code_url: str | None = None
    expires_at: datetime | None = None


def _to_response(charge: PixCharge) -> PixPaymentResponse:
    return PixPaymentResponse(
        id=charge.id,
        order_id=charge.order_id,
        amount_cents=charge.amount_cents,
        status=charge.status.value,
        br_code=charge.br_code,
        br_code_base64=charge.br_code_base64,
        qr_code_url=charge.qr_code_url,
        expires_at=charge.expires_at,
    )


@router.post("/pix", response_model=PixPaymentResponse, status_code=201)
def create_pix_payment(
    request: CreatePixPaymentRequest,
    use_case: Annotated[CreatePixPaymentUseCase, Depends(get_create_pix_payment_use_case)],
) -> PixPaymentResponse:
    charge = use_case.execute(
        CreatePixPaymentCommand(
            order_id=request.order_id,
            description=request.description,
        )
    )
    return _to_response(charge)


@router.get("/{payment_id}/status", response_model=PixPaymentResponse)
def get_payment_status(
    payment_id: str,
    use_case: Annotated[GetPaymentStatusUseCase, Depends(get_payment_status_use_case)],
) -> PixPaymentResponse:
    charge = use_case.execute(payment_id)
    return _to_response(charge)


@router.post("/webhook/abacatepay")
async def process_abacatepay_webhook(
    request: Request,
    use_case: Annotated[
        ProcessPaymentWebhookUseCase, Depends(get_process_payment_webhook_use_case)
    ],
    configured_secret: Annotated[str | None, Depends(get_abacatepay_webhook_secret)],
    webhook_secret: Annotated[str | None, Query(alias="webhookSecret")] = None,
    x_webhook_signature: Annotated[str | None, Header(alias="X-Webhook-Signature")] = None,
) -> dict[str, str]:
    raw_body = await request.body()
    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except json.JSONDecodeError:
        body = {}

    event = str(body.get("event", ""))
    data = body.get("data", {}) if isinstance(body.get("data"), dict) else {}
    payment_id = str(data.get("id", ""))
    status = str(data.get("status", "PAID"))
    external_id = str(data.get("externalId")) if data.get("externalId") else None

    use_case.execute(
        ProcessWebhookCommand(
            raw_body=raw_body,
            signature=x_webhook_signature,
            webhook_secret_param=webhook_secret,
            configured_secret=configured_secret,
            event=event,
            payment_id=payment_id,
            status=status,
            external_id=external_id,
        )
    )
    return {"status": "ok"}
