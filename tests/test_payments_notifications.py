"""Payment, notification and reporting tests."""
from app.models.registration import Registration


def test_paid_event_creates_completed_payment(client, db, admin_headers, user_headers, user):
    # Create a paid event (venue prefixed "paid:" triggers the demo fee).
    ev = client.post(
        "/api/events",
        headers=admin_headers,
        json={
            "event_name": "Paid Workshop",
            "event_date": "2030-06-01",
            "start_time": "10:00",
            "end_time": "12:00",
            "venue": "paid:49.99",
            "capacity": 20,
        },
    )
    event_id = ev.json()["id"]

    booked = client.post("/api/registrations", headers=user_headers, json={"event_id": event_id})
    assert booked.json()["result"] == "booked"
    reg_id = booked.json()["registration"]["id"]

    # A payment record was created and processed through the gateway stand-in.
    res = client.get(f"/api/users/{user.id}/registrations", headers=user_headers)
    regs = res.json()
    assert len(regs) == 1

    # Initiate explicitly via the payments API for the same registration -> rejected (one payment).
    dup = client.post("/api/payments", headers=user_headers, json={"registration_id": reg_id})
    assert dup.status_code == 400

    # Register another user and pay via the API to check the status endpoint.
    reg = Registration(user_id=user.id, event_id=event_id, status="pending")
    db.add(reg)
    db.commit()
    pay = client.post("/api/payments", headers=user_headers, json={"registration_id": reg.id})
    assert pay.status_code == 201, pay.text
    payment_id = pay.json()["id"]
    txn = pay.json()["transaction_id"]
    assert pay.json()["status"] == "completed"

    status_res = client.get(f"/api/payments/{payment_id}", headers=user_headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "completed"

    # Gateway callback flow (failure then re-success on a fresh payment).
    cb = client.post("/api/payments/callback", json={"transaction_id": txn, "result": "failure"})
    assert cb.status_code == 200
    assert cb.json()["status"] == "failed"


def test_callback_unknown_transaction(client):
    res = client.post(
        "/api/payments/callback", json={"transaction_id": "NOPE", "result": "success"}
    )
    assert res.status_code == 404


def test_notifications_flow(client, db, user_headers, user, small_event):
    client.post("/api/registrations", headers=user_headers, json={"event_id": small_event.id})

    res = client.get(f"/api/notifications/{user.id}", headers=user_headers)
    assert res.status_code == 200
    messages = res.json()
    assert any(n["type"] == "booking" for n in messages)


def test_reports_admin_only(client, db, admin_headers, user_headers, small_event):
    denied = client.get("/api/reports/events", headers=user_headers)
    assert denied.status_code == 403

    ev = client.get("/api/reports/events", headers=admin_headers)
    assert ev.status_code == 201
    assert ev.json()["report_type"] == "event_summary"
    assert ev.json()["report_data"]["total_events"] >= 1

    regs = client.get("/api/reports/registrations", headers=admin_headers)
    assert regs.status_code == 201
    assert "total_registrations" in regs.json()["report_data"]
