from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TOPA_", env_file=".env", extra="ignore")

    # host port 5435 is the compose Postgres; inside compose TOPA_DATABASE_URL points at db:5432
    database_url: str = "postgresql+psycopg://topa:topa@localhost:5435/topa"
    # browser origins allowed to call the API: exact ones (the apps' webviews) and a pattern
    # (the site's Vercel URLs, previews included); both are set in infrastructure/main.tf
    cors_origins: list[str] = []
    cors_origin_regex: str | None = None
    auth_secret_key: str = "dev-insecure-secret-change-in-production"
    abacatepay_api_key: str | None = None
    abacatepay_webhook_secret: str | None = None
    abacatepay_base_url: str = "https://api.abacatepay.com"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg3_driver(cls, value: str) -> str:
        # Neon hands out bare URLs, which SQLAlchemy maps to psycopg2; only psycopg3 is installed
        for bare_scheme in ("postgresql://", "postgres://"):
            if value.startswith(bare_scheme):
                return "postgresql+psycopg://" + value.removeprefix(bare_scheme)
        return value
