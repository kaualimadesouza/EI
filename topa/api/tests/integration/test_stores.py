from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.repositories import SqlAlchemyStoreRepository


def test_list_stores_via_repository(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyStoreRepository(session)
        stores = repo.list_all()
        slugs = [s.slug for s in stores]
        assert "lanchonete-bem-te-vi" in slugs
        assert "brasa-burgers" in slugs
        assert "bella-nonna" in slugs
        assert "acai-bowls" in slugs


def test_list_stores_endpoint_returns_all_stores(client: TestClient) -> None:
    response = client.get("/stores")
    assert response.status_code == 200
    stores = response.json()
    slugs = [s["slug"] for s in stores]
    assert "lanchonete-bem-te-vi" in slugs
    assert "brasa-burgers" in slugs
    assert "bella-nonna" in slugs
    assert "acai-bowls" in slugs
