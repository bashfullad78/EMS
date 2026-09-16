"""Auth & user management tests: registration, login, profile, authorization."""
from tests.conftest import auth_header


def test_register_and_login_flow(client, db):
    email = "newuser@example.com"
    res = client.post(
        "/api/auth/register",
        json={"name": "New User", "email": email, "password": "strong-pass-1", "phone": "+1-555-1"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["email"] == email
    assert "password_hash" not in body and "password" not in body

    # duplicate email -> duplicate-account error
    dup = client.post(
        "/api/auth/register",
        json={"name": "New User", "email": email, "password": "strong-pass-1"},
    )
    assert dup.status_code == 409

    # wrong password -> error message
    bad = client.post("/api/auth/login", json={"email": email, "password": "wrong-pass-1"})
    assert bad.status_code == 401

    # correct credentials -> token
    ok = client.post("/api/auth/login", json={"email": email, "password": "strong-pass-1"})
    assert ok.status_code == 200
    token = ok.json()["access_token"]
    assert token


def test_profile_get_update(client, user, user_headers):
    res = client.get(f"/api/users/{user.id}", headers=user_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Test User"

    upd = client.put(f"/api/users/{user.id}", headers=user_headers, json={"name": "Renamed"})
    assert upd.status_code == 200
    assert upd.json()["name"] == "Renamed"


def test_profile_requires_auth(client, user):
    assert client.get(f"/api/users/{user.id}").status_code == 401


def test_participant_cannot_access_admin_endpoint(client, user, user_headers, small_event):
    """Documented authorization test: participant denied on admin operation."""
    res = client.post(
        "/api/events",
        headers=user_headers,
        json={
            "event_name": "Nope",
            "event_date": "2030-01-01",
            "start_time": "09:00",
            "end_time": "10:00",
            "venue": "X",
            "capacity": 5,
        },
    )
    assert res.status_code == 403
