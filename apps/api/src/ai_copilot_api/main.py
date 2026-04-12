from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_copilot_api.api.routes_auth import router as auth_router
from ai_copilot_api.api.routes_campaigns import router as campaigns_router
from ai_copilot_api.api.routes_client_import import router as client_import_router
from ai_copilot_api.api.routes_clients import router as clients_router
from ai_copilot_api.api.routes_dashboard import router as dashboard_router
from ai_copilot_api.api.routes_insurers import router as insurers_router
from ai_copilot_api.api.routes_intel import router as intel_router
from ai_copilot_api.api.routes_intel_leads import router as intel_leads_router
from ai_copilot_api.api.routes_interactions import router as interactions_router
from ai_copilot_api.api.routes_jobs import router as jobs_router
from ai_copilot_api.api.routes_leads import router as leads_router
from ai_copilot_api.api.routes_me import router as me_router
from ai_copilot_api.api.routes_opportunities import router as opportunities_router
from ai_copilot_api.api.routes_org import router as org_router
from ai_copilot_api.api.routes_products import router as products_router
from ai_copilot_api.api.routes_recommendation_rules import router as recommendation_rules_router
from ai_copilot_api.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    scheduler = None
    settings = get_settings()
    if settings.adequacy_refresh_interval_minutes > 0:
        from apscheduler.schedulers.background import BackgroundScheduler

        from ai_copilot_api.jobs.adequacy_scheduler import run_scheduled_adequacy_refresh

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            run_scheduled_adequacy_refresh,
            "interval",
            minutes=settings.adequacy_refresh_interval_minutes,
            id="adequacy_refresh_all_orgs",
            replace_existing=True,
        )
        scheduler.start()
    yield
    if scheduler is not None:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="AI Copilot API",
    description=(
        "MVP API — CRM (clients, leads, segurados, audit), "
        "portfolio, pipeline, profile, interactions, batch adequacy (Phase 9)."
    ),
    version="0.7.0",
    lifespan=lifespan,
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
app.include_router(org_router, prefix="/v1")
app.include_router(clients_router, prefix="/v1")
app.include_router(client_import_router, prefix="/v1")
app.include_router(intel_router, prefix="/v1")
app.include_router(intel_leads_router, prefix="/v1")
app.include_router(recommendation_rules_router, prefix="/v1")
app.include_router(insurers_router, prefix="/v1")
app.include_router(leads_router, prefix="/v1")
app.include_router(products_router, prefix="/v1")
app.include_router(campaigns_router, prefix="/v1")
app.include_router(opportunities_router, prefix="/v1")
app.include_router(interactions_router, prefix="/v1")
app.include_router(jobs_router, prefix="/v1")
app.include_router(dashboard_router, prefix="/v1")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
