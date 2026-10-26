# topa-api

FastAPI backend of the TOPA MVP: Postgres through SQLAlchemy 2, schema in Alembic,
hexagonal layout enforced by import-linter.

## Run

From the repo root, `make run` brings up Postgres, this API and the web app with reload.
The web dev server proxies `/api/*` here with the prefix stripped, so routes live at the root.

Outside Docker, against the compose Postgres on host port 5435:

```bash
uv sync
make migrate
make run        # http://localhost:8000/health and /health/ready
```

`TOPA_DATABASE_URL` overrides the database (default
`postgresql+psycopg://topa:topa@localhost:5435/topa`).

## Test

The suite runs against a real Postgres, migrated to head by the session fixture, and fails
under 100% coverage of `src/`.

```bash
docker compose up -d --wait db   # from the repo root, or point TOPA_DATABASE_URL elsewhere
make test
```

`make check` runs everything CI does: ruff, format check, mypy strict, import contracts,
`alembic upgrade head` plus `alembic check`, and pytest.

## Layout

```
src/topa_api/
  domain/                 business rules, no frameworks, no IO
  application/            use cases and the ports they need
  adapters/db/            engine, declarative Base, Alembic support
  presentation/fastapi/   routers and response schemas
  entrypoints/            create_app() and the ASGI app
migrations/               Alembic, wired to Base.metadata
```

`domain` and `application` never import FastAPI, SQLAlchemy or an outer layer
(`make imports`). New migrations: `make migration m="add products"`.
