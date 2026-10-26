import logging
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from topa_api.application.ports import ReadinessProbe
from topa_api.settings import Settings

_logger = logging.getLogger(__name__)

# a host that drops packets would otherwise hold the readiness probe until TCP gives up
CONNECT_TIMEOUT_SECONDS = 3


def create_database_engine(database_url: str) -> Engine:
    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": CONNECT_TIMEOUT_SECONDS},
    )


@lru_cache
def get_engine() -> Engine:
    """One pool per process."""
    return create_database_engine(Settings().database_url)


class DatabaseReadinessProbe(ReadinessProbe):
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def database_is_up(self) -> bool:
        try:
            with self._engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            # the probe only answers up or down; the log is where the cause survives
            _logger.warning("database is not answering: %s", error)
            return False
        return True
