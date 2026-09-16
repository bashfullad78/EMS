"""Registration/booking and waitlist tests."""
from app.models.registration import Registration
from app.models.waitlist import Waitlist


def test_book_event_when_seat_available(client, user_headers, small_event, db):
    res = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["result"] == "booked"
    assert body["registration"]["status"] == "confirmed"


def test_booking_fills_capacity_then_waitlists(client, user_headers, other_user, user, small_event, db):
    # First user takes the single seat.
    first = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    assert first.json()["result"] == "booked"

    # Second user books via direct service call path with own auth: log them in.
    login = client.post(
        "/api/auth/login", json={"email": other_user.email, "password": "secret-password"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    second = client.post(
        "/api/registrations", headers=other_headers, json={"event_id": small_event.id}
    )
    assert second.status_code == 201
    body = second.json()
    assert body["result"] == "waitlisted"
    assert body["waitlist"]["position"] == 1

    wl = db.query(Waitlist).filter(Waitlist.user_id == other_user.id).first()
    assert wl is not None and wl.status == "waiting"


def test_waitlist_promotion_on_cancellation(client, user_headers, other_user, small_event, db):
    login = client.post(
        "/api/auth/login", json={"email": other_user.email, "password": "secret-password"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    first = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    reg_id = first.json()["registration"]["id"]
    client.post("/api/registrations", headers=other_headers, json={"event_id": small_event.id})

    # Cancel the confirmed booking -> waitlisted user is promoted.
    cancel = client.delete(f"/api/registrations/{reg_id}", headers=user_headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    promoted = (
        db.query(Registration)
        .filter(Registration.user_id == other_user.id, Registration.status == "confirmed")
        .first()
    )
    assert promoted is not None
    wl = db.query(Waitlist).filter(Waitlist.user_id == other_user.id).first()
    assert wl.status == "promoted"


def test_duplicate_booking_rejected(client, user_headers, small_event):
    client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    dup = client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    assert dup.status_code == 400


def test_user_bookings_listing(client, user_headers, user, small_event):
    client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})
    res = client.get(f"/api/users/{user.id}/registrations", headers=user_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_cannot_view_others_registration(client, user_headers, other_user, user, small_event, db):
    reg = Registration(user_id=other_user.id, event_id=small_event.id, status="confirmed")
    db.add(reg)
    db.commit()
    res = client.get(f"/api/registrations/{reg.id}", headers=user_headers)
    assert res.status_code == 403
