"""Event management tests."""
from datetime import date, timedelta


def _event_payload(**overrides):
    payload = {
        "event_name": "Conference",
        "description": "Annual conference",
        "event_date": str(date.today() + timedelta(days=30)),
        "start_time": "09:00",
        "end_time": "17:00",
        "venue": "Main Hall",
        "capacity": 100,
        "status": "scheduled",
    }
    payload.update(overrides)
    return payload


def test_admin_can_create_event(client, admin_headers):
    res = client.post("/api/events", headers=admin_headers, json=_event_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["event_name"] == "Conference"
    assert body["capacity"] == 100


def test_list_and_get_event(client, admin_headers, small_event, user_headers):
    lst = client.get("/api/events", headers=user_headers)
    assert lst.status_code == 200
    assert any(e["id"] == small_event.id for e in lst.json())

    got = client.get(f"/api/events/{small_event.id}", headers=user_headers)
    assert got.status_code == 200
    assert got.json()["confirmed_bookings"] == 0


def test_update_and_delete_event(client, admin_headers, small_event):
    upd = client.put(
        f"/api/events/{small_event.id}", headers=admin_headers, json={"capacity": 10}
    )
    assert upd.status_code == 200
    assert upd.json()["capacity"] == 10

    delete = client.delete(f"/api/events/{small_event.id}", headers=admin_headers)
    assert delete.status_code == 204
    assert client.get(f"/api/events/{small_event.id}", headers=admin_headers).status_code == 404


def test_admin_guard_on_event_cud(client, user_headers, small_event):
    assert (
        client.put(f"/api/events/{small_event.id}", headers=user_headers, json={"capacity": 3}).status_code
        == 403
    )
    assert client.delete(f"/api/events/{small_event.id}", headers=user_headers).status_code == 403
