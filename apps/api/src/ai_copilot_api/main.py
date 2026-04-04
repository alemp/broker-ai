from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_copilot_api.config import get_settings

app = FastAPI(
    title="AI Copilot API",
    description="MVP API — Phase 0 skeleton (no business routes yet).",
    version="0.1.0",
)

_settings = get_settings()
if _settings.app_env == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
