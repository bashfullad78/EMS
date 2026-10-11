"""Shared fixtures: file-backed SQLite + httpx client against the FastAPI app."""
import os
from collections.abc import Generator
from datetime import date, time, timedelta

# Keep tests off any real database: DATABASE_URL set in the shell still wins
# (os.environ beats .env in pydantic-settings), otherwise fall back to SQLite.
os.environ.setdefault("DATABASE_URL", "sqlite:///./ems_test.db")

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.main import app
from app.models.event import Event
from app.models.user import User


@pytest.fixture(scope="session", autouse=True)
def _disable_rate_limit():
    """Rate limiting is off for the shared suite (its own tests re-enable it)."""
    settings.RATE_LIMIT_ENABLED = False
    yield
    settings.RATE_LIMIT_ENABLED = True


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.drop_all(bind=engine)  # clean slate across pytest runs
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def _clean_tables():
    """Wipe all rows before each test for full isolation (SQLite FKs are off)."""
    yield
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture
def db():
    """Function-scoped session with rollback so tests stay isolated."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def user(db) -> User:
    u = User(
        name="Test User",
        email=f"user{date.today().toordinal()}-{id(db)}@example.com",
        password_hash=hash_password("secret-password"),
        contact_no="+1-555-0000",
        status="active",
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def other_user(db) -> User:
    u = User(
        name="Other User",
        email=f"other{date.today().toordinal()}-{id(db)}@example.com",
        password_hash=hash_password("secret-password"),
        status="active",
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def admin(db) -> User:
    a = User(
        name="Test Admin",
        email=f"admin{date.today().toordinal()}-{id(db)}@example.com",
        password_hash=hash_password("admin-password"),
        is_admin=True,
        status="active",
    )
    db.add(a)
    db.commit()
    return a


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return auth_header(res.json()["access_token"])


@pytest.fixture
def user_headers(client, user) -> dict:
    return login(client, user.email, "secret-password")


@pytest.fixture
def admin_headers(client, admin) -> dict:
    return login(client, admin.email, "admin-password")


@pytest.fixture
def small_event(db, admin) -> Event:
    """Capacity-1 scheduled event, useful for waitlist tests."""
    e = Event(
        admin_id=admin.id,
        event_name="Tiny Event",
        description="Only one seat",
        event_date=date.today() + timedelta(days=10),
        start_time=time(9, 0),
        end_time=time(12, 0),
        venue="Small Room",
        capacity=1,
        status="scheduled",
    )
    db.add(e)
    db.commit()
    return e


@pytest.fixture
def completed_event(db, admin) -> Event:
    e = Event(
        admin_id=admin.id,
        event_name="Past Event",
        event_date=date.today() - timedelta(days=3),
        start_time=time(9, 0),
        end_time=time(12, 0),
        venue="Hall",
        capacity=50,
        status="completed",
    )
    db.add(e)
    db.commit()
    return e
