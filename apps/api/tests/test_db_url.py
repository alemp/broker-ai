from ai_copilot_api.db.url import normalize_database_url


def test_normalize_leaves_psycopg_unchanged() -> None:
    url = "postgresql+psycopg://u:p@host/db"
    assert normalize_database_url(url) == url


def test_normalize_postgresql_to_psycopg() -> None:
    assert (
        normalize_database_url("postgresql://u:p@host/db?sslmode=require")
        == "postgresql+psycopg://u:p@host/db?sslmode=require"
    )


def test_normalize_postgres_to_psycopg() -> None:
    assert normalize_database_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
