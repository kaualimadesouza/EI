.PHONY: install lint format typecheck imports test run check migrate migration

install: ; uv sync
lint: ; uv run ruff check .
format: ; uv run ruff format .
typecheck: ; uv run mypy
imports: ; uv run lint-imports
test: ; uv run pytest
run: ; uv run uvicorn topa_api.entrypoints.rest_application:app --reload
check: ; uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run alembic upgrade head && uv run alembic check && uv run pytest
migrate: ; uv run alembic upgrade head
migration: ; uv run alembic revision --autogenerate -m "$(m)"
