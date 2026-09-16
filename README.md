# Event Management System (EMS) — Backend

FastAPI + Pydantic + SQLAlchemy 2 + PostgreSQL backend implementing the spec in
(24 documented endpoints across 8 components).

## Quick start

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # adjust DATABASE_URL for PostgreSQL
python -m app.seed              # creates admin + demo events
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

Without a `.env`, the app falls back to a local SQLite file (`ems_local.db`) so
it runs out of the box; set `DATABASE_URL` in `.env` for PostgreSQL.

## Seeded accounts

| Account | Email | Password |
| --- | --- | --- |
| Admin | admin@example.com | admin-password |
| User | alice@example.com | alice-password |
| User | bob@example.com | bob-password |

Demo events include a small-capacity event (to exercise the waitlist), a paid
event (to exercise the payment flow) and a completed event (certificates).

## Layout

```
app/
  core/      config, DB engine/session, security (JWT/bcrypt), dependencies
  models/    SQLAlchemy models (9 entities from docs/database.md)
  schemas.py Pydantic request/response schemas
  services/  business logic: bookings/waitlist, payments, notifications,
             certificates, reports
  routers/   FastAPI routers per component 
  main.py    app entrypoint
  seed.py    demo data
tests/       integration tests over the full API
```

## Test traceability

Every documented case in (TC-01 … TC-18) is covered by the
suite and tagged in test docstrings:

| Documented cases | Tests |
| --- | --- |
| TC-01…04 (registration/login) | `tests/test_auth.py` |
| TC-05, TC-16 (events + admin guard) | `tests/test_events.py` |
| TC-07, TC-08 (booking / full event) | `tests/test_bookings.py` |
| TC-10, TC-11, TC-12, TC-13 (payments/notifications/reports) | `tests/test_payments_notifications.py` |
| TC-14, TC-15 (certificates) | `tests/test_certificates.py` |
| TC-06, TC-09, TC-17, TC-18 (+ TC-10/11 details) | `tests/test_docs_cases.py` |

## Notes

- Auth: JWT bearer tokens (`POST /api/auth/login`). Admin-only routes use a
  role guard on the `users.is_admin` flag (ADMIN and USER share one table).
- Booking follows `docs/componentlogic.md`: capacity check → booking or
  waitlist → payment for paid events → notifications.
- Cancelling a confirmed booking promotes the first waitlisted user.
- Certificates require the event to be `completed` and a non-cancelled
  registration; certificate numbers are unique.
- The payment gateway is an in-process stand-in (`app/services/payments.py`);
  replace `_call_gateway` and wire `POST /api/payments/callback` to your
  provider's webhook.
