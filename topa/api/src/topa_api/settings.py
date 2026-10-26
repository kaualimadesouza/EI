from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TOPA_", env_file=".env", extra="ignore")

    # host port 5435 is the compose Postgres; inside compose TOPA_DATABASE_URL points at db:5432
    database_url: str = "postgresql+psycopg://topa:topa@localhost:5435/topa"
