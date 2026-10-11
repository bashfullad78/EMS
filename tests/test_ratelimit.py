"""Rate limiting on the sensitive auth endpoints (429 + Retry-After)."""
import pytest

from app.core.config import settings
from app.core import ratelimit


@pytest.fixture(autouse=True)
def _strict_limits():
    settings.RATE_LIMIT_ENABLED = True
    settings.RATE_LIMIT_LOGIN_PER_MINUTE = 3
    settings.RATE_LIMIT_REGISTER_PER_MINUTE = 2
    settings.RATE_LIMIT_ACCOUNT_UPDATE_PER_MINUTE = 2
    ratelimit.reset()
    yield
    ratelimit.reset()
    settings.RATE_LIMIT_ENABLED = False
    settings.RATE_LIMIT_LOGIN_PER_MINUTE = 5
    settings.RATE_LIMIT_REGISTER_PER_MINUTE = 10
    settings.RATE_LIMIT_ACCOUNT_UPDATE_PER_MINUTE = 10


def test_login_rate_limited(client):
    payload = {"email": "nobody@example.com", "password": "wrong-password"}
    for _ in range(3):
        res = client.post("/api/auth/login", json=payload)
        assert res.status_code == 401, res.text

    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 429
    assert "Retry-After" in res.headers


def test_register_rate_limited(client):
    for i in range(2):
        res = client.post(
            "/api/auth/register",
            json={
                "name": f"User {i}",
                "email": f"rl-user-{i}@example.com",
                "password": "password-123",
            },
        )
        assert res.status_code == 201, res.text

    res = client.post(
        "/api/auth/register",
        json={"name": "User X", "email": "rl-user-x@example.com", "password": "password-123"},
    )
    assert res.status_code == 429
    assert "Retry-After" in res.headers


def test_account_update_rate_limited(client, db, user):
    from tests.conftest import login

    headers = login(client, user.email, "secret-password")
    for name in ("A", "B"):
        res = client.put(f"/api/users/{user.id}", headers=headers, json={"name": name})
        assert res.status_code == 200, res.text

    res = client.put(f"/api/users/{user.id}", headers=headers, json={"name": "C"})
    assert res.status_code == 429
    assert "Retry-After" in res.headers


def test_rate_limit_disabled(client):
    settings.RATE_LIMIT_ENABLED = False
    payload = {"email": "nobody@example.com", "password": "wrong-password"}
    for _ in range(5):
        res = client.post("/api/auth/login", json=payload)
        assert res.status_code == 401, res.text
