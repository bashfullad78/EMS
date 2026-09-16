"""Event Management System API - FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app import models  # noqa: F401 - registers all tables on Base.metadata
from app.routers import (
    auth,
    certificates,
    events,
    notifications,
    payments,
    registrations,
    reports,
    waitlist,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: create tables on startup. Production should use Alembic.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend for the Event Management System (EMS) - bookings, waitlists, "
    "payments, notifications, certificates and reports.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(auth.users_router)
app.include_router(registrations.users_bookings_router)
app.include_router(events.router)
app.include_router(registrations.router)
app.include_router(waitlist.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(certificates.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": settings.APP_NAME, "status": "ok", "docs": "/docs"}
