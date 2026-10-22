"""qorgan API — FastAPI application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.repositories import get_repositories
from app.routers import ai, auth, consents, credits, dss, me, notifications, overview, reports
from app.seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    # TODO: Database — open the connection pool / run migrations check here, and dispose it on shutdown.
    if settings.seed_demo_data:
        seed(get_repositories())
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, me.router, credits.router, reports.router, overview.router, ai.router,
          notifications.router, consents.router, dss.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    # TODO: Database — include a DB ping in the health check.
    return {"status": "ok"}
