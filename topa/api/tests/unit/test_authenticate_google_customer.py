import base64
import json
import uuid
from datetime import UTC, datetime

import pytest

from tests.fakes import FakeCustomerRepository, FakePasswordHasher, FakeTokenService, FixedClock
from topa_api.adapters.security.google_token_verifier import GoogleTokenVerifier
from topa_api.application.authenticate_google_customer import (
    AuthenticateGoogleCustomerUseCase,
    GoogleCustomerAuth,
)
from topa_api.domain.auth import Customer
from topa_api.domain.errors import InvalidCustomerDataError


def test_authenticate_google_customer_creates_new_user() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    verifier = GoogleTokenVerifier()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, verifier, clock)
    auth = use_case.execute(GoogleCustomerAuth(id_token="google-mock-jwt-token"))

    assert auth.name == "Aluno Google USP"
    assert auth.email == "aluno.google@usp.br"
    assert auth.token_type == "bearer"
    assert len(auth.access_token) > 0

    record = customers.get_by_email("aluno.google@usp.br")
    assert record is not None
    assert record.customer.name == "Aluno Google USP"


def test_authenticate_google_customer_existing_user() -> None:
    now = datetime(2026, 10, 31, 21, 0, tzinfo=UTC)
    clock = FixedClock(now)
    customers = FakeCustomerRepository()
    existing_id = uuid.uuid4()
    customers.add(
        Customer(
            id=existing_id,
            name="Aluno Google USP",
            email="aluno.google@usp.br",
            created_at=now,
        ),
        password_hash="existing_hash",
    )
    hasher = FakePasswordHasher()
    tokens = FakeTokenService()
    verifier = GoogleTokenVerifier()

    use_case = AuthenticateGoogleCustomerUseCase(customers, hasher, tokens, verifier, clock)
    auth = use_case.execute(GoogleCustomerAuth(id_token="google-mock-jwt-token"))

    assert auth.name == "Aluno Google USP"
    assert auth.email == "aluno.google@usp.br"


def test_google_token_verifier_supported_formats() -> None:
    verifier = GoogleTokenVerifier()

    # 1. Preset mock tokens
    id1 = verifier.verify_id_token("google-oauth-demo-token")
    assert id1.email == "aluno.google@usp.br"

    # 2. Mock prefix format
    id2 = verifier.verify_id_token("mock:pedro@usp.br:Pedro Santos")
    assert id2.email == "pedro@usp.br"
    assert id2.name == "Pedro Santos"

    # Mock prefix format with default name
    id2_default = verifier.verify_id_token("mock:pedro@usp.br")
    assert id2_default.email == "pedro@usp.br"
    assert id2_default.name == "Usuário Google"

    # 3. Base64 JWT payload format
    payload = base64.urlsafe_b64encode(
        json.dumps({"email": "mariana@usp.br", "name": "Mariana Souza"}).encode("utf-8")
    ).decode("utf-8")
    jwt_token = f"header.{payload}.sig"
    id3 = verifier.verify_id_token(jwt_token)
    assert id3.email == "mariana@usp.br"
    assert id3.name == "Mariana Souza"

    # JWT payload with default name
    payload_no_name = base64.urlsafe_b64encode(
        json.dumps({"email": "mariana@usp.br"}).encode("utf-8")
    ).decode("utf-8")
    id3_default = verifier.verify_id_token(f"header.{payload_no_name}.sig")
    assert id3_default.name == "Usuário Google"


def test_google_token_verifier_rejects_invalid_tokens() -> None:
    verifier = GoogleTokenVerifier()

    # Empty token
    with pytest.raises(InvalidCustomerDataError, match="Token do Google obrigatório"):
        verifier.verify_id_token("")

    # Unknown token
    with pytest.raises(InvalidCustomerDataError, match="Token do Google inválido ou expirado"):
        verifier.verify_id_token("random-untrusted-token")

    # Mock token with invalid email
    with pytest.raises(InvalidCustomerDataError, match="Token do Google inválido ou expirado"):
        verifier.verify_id_token("mock:bademail")

    with pytest.raises(InvalidCustomerDataError, match="Token do Google inválido ou expirado"):
        verifier.verify_id_token("mock:")

    # Malformed base64 in 3-part token
    with pytest.raises(InvalidCustomerDataError, match="Token do Google inválido ou expirado"):
        verifier.verify_id_token("h.bad!!!base64.s")

    # 3-part token with missing or invalid email
    bad_payload = base64.urlsafe_b64encode(
        json.dumps({"email": "not-an-email"}).encode("utf-8")
    ).decode("utf-8")
    with pytest.raises(InvalidCustomerDataError, match="Token do Google inválido ou expirado"):
        verifier.verify_id_token(f"h.{bad_payload}.s")
