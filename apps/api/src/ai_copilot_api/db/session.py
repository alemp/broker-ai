from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


@lru_cache
def _engine() -> object:
    from ai_copilot_api.config import get_settings

    return create_engine(str(get_settings().database_url), pool_pre_ping=True)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(autocommit=False, autoflush=False, bind=_engine())


def get_db() -> Generator[Session, None, None]:
    db = _session_factory()()
    try:
        yield db
    finally:
        db.close()


def new_session() -> Session:
    """Standalone session for background jobs (caller must close)."""
    return _session_factory()()
