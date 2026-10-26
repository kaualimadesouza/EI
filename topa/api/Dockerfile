FROM ghcr.io/astral-sh/uv:0.9.26 AS uv

# local development image, not a deploy artifact: compose mounts src/ and
# migrations/ over the copies below and uvicorn reloads on every change
FROM python:3.12-slim

COPY --from=uv /uv /usr/local/bin/uv

# the venv lives outside /app so no bind mount over /app can hide it
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# editable install: the .pth points at /app/src, so the mounted code is what runs
COPY README.md alembic.ini ./
COPY src ./src
COPY migrations ./migrations
RUN uv sync --frozen

# a root process writing __pycache__ into the mount leaves root-owned files on the host
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn topa_api.entrypoints.rest_application:app --host 0.0.0.0 --port 8000 --reload --reload-dir src"]
