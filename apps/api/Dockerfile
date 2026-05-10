FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
# PyPI from Docker is often slower; defaults (10s connect / 30s read) can fail on wheel/setuptools.
ENV UV_HTTP_CONNECT_TIMEOUT=60
ENV UV_HTTP_TIMEOUT=120
ENV UV_HTTP_RETRIES=5

COPY pyproject.toml uv.lock ./
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts ./scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-por \
    && rm -rf /var/lib/apt/lists/*

RUN uv sync --frozen --no-dev --no-install-project \
    && uv pip install "setuptools>=75" wheel \
    && uv sync --frozen --no-dev --no-build-isolation

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
