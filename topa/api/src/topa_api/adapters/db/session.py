import logging
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from topa_api.settings import get_settings

_logger = logging.getLogger(__name__)


@lru_cache
def get_engine() -> Engine:
    """One pool per process; tests swap it through FastAPI's dependency overrides."""
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def database_is_up(engine: Engine) -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        # the probe only answers up or down; the log is where the cause survives
        _logger.warning("database is not answering: %s", error)
        return False
    return True
