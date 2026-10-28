# topa-api

FastAPI backend of the TOPA MVP: Postgres through SQLAlchemy 2, schema in Alembic,
hexagonal layout enforced by import-linter.

The schema, as an ER diagram: [`docs/banco-de-dados.md`](../../docs/banco-de-dados.md).

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

`TOPA_CORS_ORIGINS` is a JSON list of the browser origins allowed to call the API (none by
default; the local web app goes through the Vite proxy and needs none).

## Deploy

AWS Lambda behind an API Gateway HTTP API, Postgres on Neon, Terraform in `infrastructure/`:
see [`infrastructure/README.md`](infrastructure/README.md). The Lambda image is
`Dockerfile.lambda` (entrypoint `topa_api.entrypoints.lambda_handler`); `Dockerfile` stays the
local development image.

## Check

`make check` is the one command CI runs, from `topa/api/`:

- `make lint`: ruff, ruff format check, mypy strict and the import-linter contracts.
- `make test`: pytest, failing under 100% coverage of `src/`.

The suite never touches the database in `TOPA_DATABASE_URL`: it creates `topa_test` on the
same server, migrates it to head, deletes the orders and puts every product back on sale
after each test (the seeded menu stays) and drops it at the end. The user in that URL needs the `CREATEDB` privilege. The migration roundtrip
(`downgrade base`, `upgrade head` again, and the `alembic check` diff against the models)
runs there too, in `tests/integration/test_migrations.py`.

```bash
docker compose up -d --wait db   # from topa/, or point TOPA_DATABASE_URL elsewhere
make test
```

## Endpoints

- `GET /products`: the whole menu in display order, sold-out products included with
  `available: false`.
- `PATCH /products/{id}`: `{"available": bool}` marks a product sold out or back on sale and
  answers 200 with it; from the next `POST /orders` on, a sold-out product is refused.
- `POST /orders`: `{"items": [{"product_id", "quantity"}], "dine_in", "payment_method"}`
  (`card` or `pix`). Prices come from the `products` table, never from the body; repeated
  products are merged. Answers 201 with the order and its number, which restarts at 1 every
  business day (America/Sao_Paulo).
- `GET /orders?date=YYYY-MM-DD`: one business day's orders by number, each shaped like the
  `POST /orders` answer with its items in menu order. Without `date`, today in São Paulo.
- `GET /orders/{id}`: one order as it stands now, shaped the same way; the customer's phone
  follows its order with it. 404 when no order has that id.
- `PATCH /orders/{id}`: `{"status": ...}` moves the order along `received`, `preparing`,
  `ready`, `delivered`, one step forward or one back (the dashboard's undo), and answers 200
  with it.

Every error body is `{"detail": "<one pt-BR sentence>"}`: 422 for an empty order, a
quantity outside 1 to 20 per product, an unknown product or a malformed body, path or query;
409 for a sold-out product or a status change that is not
one step; 404 for an unknown order or product. Metrics are not an endpoint: the
dashboard computes them from `GET /orders`.

## Layout

```
src/topa_api/
  domain/                 catalog, order rules and their pt-BR errors, no frameworks, no IO
  application/            use cases (place, list, read and move orders, product availability)
                          and the ports they need (repositories, clock, readiness probe)
  adapters/               SQLAlchemy models and repositories, engine, system clock
  presentation/fastapi/   routers, request/response schemas, the ports routes ask for, error handlers
  entrypoints/            create_app(): binds each port to its adapter; the ASGI app and the Lambda handler
migrations/               Alembic, wired to Base.metadata; the first one seeds the demo menu
```

Each layer imports only the ones below it (entrypoints, presentation, application, domain).
Adapters implement application ports and only `entrypoints` may import them, so a route
reaches the database through a port. New migrations: `make migration m="add products"`.
