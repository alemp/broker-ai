"""Helpers for database URLs (e.g. Neon copies `postgresql://` — we use psycopg3)."""


def normalize_database_url(url: str) -> str:
    if "+psycopg" in url:
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url
