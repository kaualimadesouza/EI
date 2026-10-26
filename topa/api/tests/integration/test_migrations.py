from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect

from topa_api.adapters.db.base import Base


def application_tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names()) - {"alembic_version"}


def test_migrations_downgrade_to_base_and_upgrade_back_to_head(
    db_engine: Engine, alembic_config: Config
) -> None:
    """On topa_test, never TOPA_DATABASE_URL; it ends at head for the tests that follow."""
    assert application_tables(db_engine) == set(Base.metadata.tables)

    command.downgrade(alembic_config, "base")
    assert application_tables(db_engine) == set()

    command.upgrade(alembic_config, "head")
    assert application_tables(db_engine) == set(Base.metadata.tables)


def test_migrations_at_head_match_the_models(db_engine: Engine, alembic_config: Config) -> None:
    """A model changed without its migration fails here, as `alembic check` would."""
    command.check(alembic_config)
