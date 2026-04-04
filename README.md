# AI Copilot

Monorepo for the intelligent sales copilot MVP (brokerage design partner).

- **Product idea** [`docs/`](./docs/) — [`docs/PRODUCT.md`](./docs/PRODUCT.md).
- **Documentation:** [`docs/`](./docs/) — start with [`docs/IMPLEMENTATION-SPEC.md`](./docs/IMPLEMENTATION-SPEC.md).
- **Phase 0 stack and tooling:** [`docs/PHASE-0-STACK.md`](./docs/PHASE-0-STACK.md).
- **Local setup (API, web, Postgres):** [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

```bash
docker compose up --build
```

Then open **http://localhost:8080** (web) and **http://localhost:8000/docs** (API). For Postgres-only or hybrid local dev, see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
