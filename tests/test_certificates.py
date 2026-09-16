"""Certificate tests: eligibility, uniqueness, retrieval (TC-14, TC-15)."""
from datetime import date

from app.models.registration import Registration


def _register(db, user, event) -> Registration:
    """Create a registration row directly: completed events cannot be
    booked through the API (only `scheduled` events are open)."""
    reg = Registration(user_id=user.id, event_id=event.id, status="confirmed")
    db.add(reg)
    db.commit()
    return reg


def test_certificate_for_completed_event(client, db, user_headers, user, completed_event):
    """TC-14: eligible participant on a completed event -> certificate generated."""
    reg = _register(db, user, completed_event)
    res = client.post(f"/api/certificates/issue/{reg.id}", headers=user_headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["certificate_no"].startswith("CERT-")
    assert body["status"] == "issued"
    assert body["issue_date"] == date.today().isoformat()

    # Retrieval by id (owner).
    got = client.get(f"/api/certificates/{body['id']}", headers=user_headers)
    assert got.status_code == 200
    assert got.json()["certificate_no"] == body["certificate_no"]


def test_certificate_denied_for_scheduled_event(client, db, user_headers, user, admin_headers, small_event):
    """TC-15: ineligible participant (event not completed) -> no certificate."""
    booked = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    assert booked.json()["result"] == "booked"
    reg_id = booked.json()["registration"]["id"]

    res = client.post(f"/api/certificates/issue/{reg_id}", headers=user_headers)
    assert res.status_code == 400
    assert "not completed" in res.json()["detail"].lower()


def test_certificate_denied_for_cancelled_registration(client, db, user_headers, user, completed_event):
    """TC-15 (variant): cancelled registrations are not eligible."""
    reg = _register(db, user, completed_event)
    reg.status = "cancelled"
    db.commit()

    res = client.post(f"/api/certificates/issue/{reg.id}", headers=user_headers)
    assert res.status_code == 400


def test_certificate_unique_per_registration(client, db, user_headers, user, completed_event):
    """TC-14 (idempotency): re-request returns the same certificate, not a second one."""
    reg = _register(db, user, completed_event)
    first = client.post(f"/api/certificates/issue/{reg.id}", headers=user_headers)
    second = client.post(f"/api/certificates/issue/{reg.id}", headers=user_headers)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["certificate_no"] == second.json()["certificate_no"]
    assert first.json()["id"] == second.json()["id"]
