from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_copilot_api.api.routes_auth import router as auth_router
from ai_copilot_api.api.routes_me import router as me_router
from ai_copilot_api.config import get_settings

app = FastAPI(
    title="AI Copilot API",
    description="MVP API — Phase 1: identity and organization scope.",
    version="0.2.0",
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/v1/auth", tags=["auth"])
app.include_router(me_router, prefix="/v1", tags=["users"])


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
