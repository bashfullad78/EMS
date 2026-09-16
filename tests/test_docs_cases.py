"""Tests for documented cases from docs/tests.md that the original suite
did not fully cover: TC-06, TC-09, TC-10, TC-11, TC-17, TC-18.

(TC-01..05, 07, 08, 12..16 are covered in test_auth.py, test_events.py,
test_bookings.py, test_payments_notifications.py and test_certificates.py.)
"""
from datetime import date, timedelta

from app.models.event import Event
from app.models.payment import Payment
from app.models.registration import Registration


def _future_date() -> str:
    return str(date.today() + timedelta(days=21))


def test_tc06_invalid_event_data_rejected(client, admin_headers):
    """TC-06: incomplete/invalid event details -> validation error (422)."""
    # Missing required fields entirely.
    res = client.post("/api/events", headers=admin_headers, json={"event_name": "Broken"})
    assert res.status_code == 422

    # Invalid capacity (must be > 0).
    res2 = client.post(
        "/api/events",
        headers=admin_headers,
        json={
            "event_name": "Broken Capacity",
            "event_date": _future_date(),
            "start_time": "09:00",
            "end_time": "10:00",
            "venue": "Room 1",
            "capacity": 0,
        },
    )
    assert res2.status_code == 422


def test_tc09_join_waitlist_assigns_position(client, db, user_headers, user, other_user, small_event):
    """TC-09: explicit waitlist join -> entry created with a valid position."""
    # Fill the single seat so the event is full.
    db.add(Registration(user_id=other_user.id, event_id=small_event.id, status="confirmed"))
    db.commit()

    res = client.post("/api/waitlist", headers=user_headers, json={"event_id": small_event.id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["event_id"] == small_event.id
    assert body["user_id"] == user.id
    assert body["position"] == 1
    assert body["status"] == "waiting"


def test_tc10_payment_success(client, db, user_headers, user, small_event):
    """TC-10: successful payment -> marked completed with transaction id."""
    reg = Registration(user_id=user.id, event_id=small_event.id, status="pending")
    db.add(reg)
    db.commit()

    res = client.post("/api/payments", headers=user_headers, json={"registration_id": reg.id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "completed"
    assert body["transaction_id"] and body["transaction_id"].startswith("TXN-")
    assert body["payment_date"] is not None

    # Status remains retrievable afterwards.
    got = client.get(f"/api/payments/{body['id']}", headers=user_headers)
    assert got.status_code == 200
    assert got.json()["status"] == "completed"


def test_tc11_payment_failure_via_callback(client, db, user_headers, user, small_event):
    """TC-11: simulated failed transaction -> payment marked failed."""
    reg = Registration(user_id=user.id, event_id=small_event.id, status="pending")
    db.add(reg)
    db.commit()

    paid = client.post("/api/payments", headers=user_headers, json={"registration_id": reg.id})
    assert paid.status_code == 201
    txn = paid.json()["transaction_id"]
    payment_id = paid.json()["id"]

    cb = client.post("/api/payments/callback", json={"transaction_id": txn, "result": "failure"})
    assert cb.status_code == 200, cb.text
    assert cb.json()["status"] == "failed"

    db.expire_all()
    stored = db.get(Payment, payment_id)
    assert stored is not None and stored.status == "failed"


def test_tc17_booking_persists_correct_record(client, db, user_headers, user, small_event):
    """TC-17: after booking, the REGISTRATION record is stored with correct data."""
    res = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    assert res.status_code == 201
    reg_id = res.json()["registration"]["id"]

    db.expire_all()
    row = db.get(Registration, reg_id)
    assert row is not None
    assert row.user_id == user.id
    assert row.event_id == small_event.id
    assert row.status == "confirmed"
    assert row.booking_date is not None


def test_tc18_event_update_reflected_in_db(client, db, admin_headers, small_event):
    """TC-18: admin updates an event -> database reflects updated information."""
    res = client.put(
        f"/api/events/{small_event.id}",
        headers=admin_headers,
        json={"event_name": "Renamed Event", "capacity": 5},
    )
    assert res.status_code == 200

    db.expire_all()
    row = db.get(Event, small_event.id)
    assert row.event_name == "Renamed Event"
    assert row.capacity == 5
