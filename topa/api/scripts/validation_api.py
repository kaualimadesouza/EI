"""Local-only API with an explicitly controlled payment provider for usability tests.

Run from topa/api with TOPA_DATABASE_URL pointing at the disposable validation DB:
uv run --locked python -m scripts.validation_api
Never packaged as the production entrypoint. No payment is sent to a bank.
"""

from dataclasses import replace

import uvicorn
from fastapi import HTTPException
from sqlalchemy import make_url
from tests.fakes import FakePaymentGateway

from topa_api.domain.payment import PaymentStatus
from topa_api.entrypoints.rest_application import create_app
from topa_api.presentation.fastapi.dependencies import get_payment_gateway
from topa_api.settings import Settings


def main() -> None:
    url = make_url(Settings().database_url)
    if url.host not in {"127.0.0.1", "localhost"} or url.database != "topa_validation":
        raise RuntimeError("Use somente o banco local descartável topa_validation.")
    app = create_app()
    gateway = FakePaymentGateway()
    app.dependency_overrides[get_payment_gateway] = lambda: gateway

    @app.post("/__validation/payments/{payment_id}/confirm")
    def confirm_payment(payment_id: str) -> dict[str, str]:
        charge = gateway.charges.get(payment_id)
        if charge is None:
            raise HTTPException(status_code=404, detail="Cobrança de teste não encontrada.")
        gateway.charges[payment_id] = replace(charge, status=PaymentStatus.PAID)
        return {"status": "PAID", "provider": "local-test-fixture"}

    uvicorn.run(app, host="127.0.0.1", port=8022)


if __name__ == "__main__":
    main()
