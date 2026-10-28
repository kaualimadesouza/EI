from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TOPA_", env_file=".env", extra="ignore")

    # host port 5435 is the compose Postgres; inside compose TOPA_DATABASE_URL points at db:5432
    database_url: str = "postgresql+psycopg://topa:topa@localhost:5435/topa"
    # browser origins allowed to call the API: the deployed site and the apps' webviews
    cors_origins: list[str] = []

    @field_validator("database_url")
    @classmethod
    def _use_psycopg3_driver(cls, value: str) -> str:
        # Neon hands out bare URLs, which SQLAlchemy maps to psycopg2; only psycopg3 is installed
        for bare_scheme in ("postgresql://", "postgres://"):
            if value.startswith(bare_scheme):
                return "postgresql+psycopg://" + value.removeprefix(bare_scheme)
        return value
