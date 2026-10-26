# topa-api

FastAPI backend of the TOPA MVP: Postgres through SQLAlchemy 2, schema in Alembic,
hexagonal layout enforced by import-linter.

## Run

From `topa/`, `make run` brings up Postgres, this API and the web app with reload.
The web dev server proxies `/api/*` here with the prefix stripped, so routes live at the root.

Outside Docker, from `topa/api/`, against the compose Postgres on host port 5435:

```bash
uv sync
make migrate
make run        # http://localhost:8000/health and /health/ready
```

`TOPA_DATABASE_URL` overrides the database (default
`postgresql+psycopg://topa:topa@localhost:5435/topa`).

## Check

`make check` is the one command CI runs, from `topa/api/`:

- `make lint`: ruff, ruff format check, mypy strict and the import-linter contracts.
- `make test`: pytest, failing under 100% coverage of `src/`.

The suite never touches the database in `TOPA_DATABASE_URL`: it creates `topa_test` on the
same server, migrates it to head, truncates every table after each test and drops it at
the end. The user in that URL needs the `CREATEDB` privilege. The migration roundtrip
(`downgrade base`, `upgrade head` again, and the `alembic check` diff against the models)
runs there too, in `tests/integration/test_migrations.py`.

```bash
docker compose up -d --wait db   # from topa/, or point TOPA_DATABASE_URL elsewhere
make test
```

## Layout

```
src/topa_api/
  domain/                 business rules, no frameworks, no IO
  application/            use cases and the ports they need
  adapters/db/            engine, readiness probe, declarative Base
  presentation/fastapi/   routers, response schemas, the dependencies routes ask for
  entrypoints/            create_app(): picks the adapter behind each port
migrations/               Alembic, wired to Base.metadata
```

Each layer imports only the ones below it (entrypoints, presentation, application, domain).
Adapters implement application ports and only `entrypoints` may import them, so a route
reaches the database through a port. New migrations: `make migration m="add products"`.
