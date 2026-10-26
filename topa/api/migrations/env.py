from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from topa_api.adapters.db.base import Base
from topa_api.settings import Settings

config = context.config

if config.config_file_name is not None:
    # keep application loggers alive (pytest caplog, uvicorn) when alembic configures logging
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# read straight from Settings: set_main_option would choke on a %-encoded password
database_url = Settings().database_url
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(database_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
