from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

SQLITE_COLUMN_PATCHES = {
    "visit_drafts": [("payload_json", "TEXT DEFAULT '{}'")],
    "conversations": [
        ("customer_id", "VARCHAR(80)"),
        ("customer_name", "VARCHAR(120)"),
    ],
    "conversation_turns": [
        ("kind", "VARCHAR(32) DEFAULT 'message'"),
        ("payload_json", "TEXT DEFAULT '{}'"),
    ],
}


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    """create_all 不会给已有 SQLite 表加列；演示库需要可重复的轻量补列。"""
    from app import models as _models  # noqa: F401  确保表已注册到 Base.metadata

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in SQLITE_COLUMN_PATCHES.items():
            if table not in inspector.get_table_names():
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
