.PHONY: install format lint test check run migrate migration

install: ; uv sync
format: ; uv run ruff format .
lint: ; uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports
# includes the migration roundtrip, run on the suite's own topa_test database
test: ; uv run pytest
# what CI runs
check: lint test
run: ; uv run uvicorn topa_api.entrypoints.rest_application:app --reload
migrate: ; uv run alembic upgrade head
migration: ; uv run alembic revision --autogenerate -m "$(m)"
