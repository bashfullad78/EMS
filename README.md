# Event Management System (EMS)

FastAPI + Pydantic + SQLAlchemy 2 + PostgreSQL backend — 26 API endpoints across
9 routers (auth, users, events, registrations, waitlist, payments,
notifications, reports, certificates) — plus a React + Vite frontend in
`frontend/`.

## Quick start

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # defaults to local SQLite; set DATABASE_URL for PostgreSQL
python -m app.seed              # creates admin + demo events
uvicorn app.main:app --reload   # http://localhost:8000/docs

# frontend (separate terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

A `.env` is required (`DATABASE_URL`, `JWT_SECRET_KEY`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`). The shipped `.env.example`
defaults `DATABASE_URL` to a local SQLite file (`ems_local.db`) so the app runs
out of the box; the deployed environment points `DATABASE_URL` at PostgreSQL.

## Seeded accounts

| Account | Email | Password |
| --- | --- | --- |
| Admin | admin@example.com | random — stored in `password.txt` (gitignored) |
| User | alice@example.com | alice-password |
| User | bob@example.com | bob-password |

`python -m app.seed` generates a strong random admin password and writes it to
`password.txt` at the repo root (never commit it). To reset the admin password
on an already-seeded or deployed database, run
`python -m app.seed --rotate-admin` — it sets a fresh random password and
rewrites `password.txt`.

Demo events include a small-capacity event (to exercise the waitlist), a paid
event (to exercise the payment flow) and a completed event (certificates).

## Using the site as a regular attendee

No admin rights needed — the public site is open to everyone.

### Browsing (no account required)

Open **http://localhost:5173**. The front page shows upcoming
**scheduled** events with:

- date, venue, start–end times and a short description
- a price badge on paid events (demo pricing: the fee is encoded in the
  venue as `paid:<amount>`, e.g. `paid:49.99`)
- live seat availability (`x / y seats`) and waitlist count

The sign-in page (`/login`) is for everyone. Attendees can create an
account or sign in and then use the full web UI:

- **Event detail** (`/events/:id`) — book a free seat, or book & pay a
  paid event through the dummy gateway (the fee is simulated, no real
  charge)
- **My bookings** (`/bookings`) — view upcoming/active and cancelled
  bookings, cancel a seat (the next waitlisted attendee is promoted)
- **Profile** (`/profile`) — update name/phone and change password

The admin console (`/admin/...`) is separate and guarded by an admin role;
regular accounts get a 403 screen there.

### Attendee flow (API reference)

The same flow is available over the API. All attendee endpoints take the
JWT from login as `Authorization: Bearer <token>`.

```bash
# 1. Create an account (or use a seeded one: alice@example.com / alice-password)
curl -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name": "Sam", "email": "sam@example.com", "password": "sam-password"}'

# 2. Log in and keep the access_token
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "sam@example.com", "password": "sam-password"}'

# 3. Browse events (public — no token needed)
curl http://localhost:8000/api/events
curl http://localhost:8000/api/events/1        # detail incl. seat/waitlist counts

# 4. Book a seat — auto-waitlisted when the event is full
curl -X POST http://localhost:8000/api/registrations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"event_id": 1}'

# 5. Pay for a paid event (dummy gateway — completes instantly)
curl -X POST http://localhost:8000/api/payments \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"registration_id": 1}'

# 6. View / cancel your bookings (cancelling promotes the next waitlisted user)
curl http://localhost:8000/api/users/me-id/registrations -H "Authorization: Bearer $TOKEN"
curl -X DELETE http://localhost:8000/api/registrations/1 -H "Authorization: Bearer $TOKEN"

# 7. Update your profile
curl -X PUT http://localhost:8000/api/users/me-id \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name": "Sam Updated"}'
```

Replace `me-id` with your user id (returned by register/login). Once an event
is marked `completed` by an admin, attendees can issue and fetch their own
certificate and list their notifications (API only for now):

```bash
curl -X POST http://localhost:8000/api/certificates/issue/1 -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/certificates/1 -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/notifications/me-id -H "Authorization: Bearer $TOKEN"
```

## Layout

```
app/
  core/      config, DB engine/session, security (JWT/bcrypt), dependencies
  models/    SQLAlchemy models (8 entities: user, event, registration,
             waitlist, payment, notification, certificate, report)
  schemas.py Pydantic request/response schemas
  services/  business logic: bookings/waitlist, payments, notifications,
             certificates, reports
  routers/   FastAPI routers per component 
  main.py    app entrypoint
  seed.py    demo data
tests/       integration tests over the full API
```

## Test traceability

Every documented case (TC-01 … TC-18) is covered by the suite; the cases not
fully covered by the topical files live in `tests/test_docs_cases.py`:

| Documented cases | Tests |
| --- | --- |
| TC-01…04 (registration/login) | `tests/test_auth.py` |
| TC-05, TC-16 (events + admin guard) | `tests/test_events.py` |
| TC-07, TC-08 (booking / full event) | `tests/test_bookings.py` |
| TC-10, TC-11, TC-12, TC-13 (payments/notifications/reports) | `tests/test_payments_notifications.py` |
| TC-14, TC-15 (certificates) | `tests/test_certificates.py` |
| TC-06, TC-09, TC-17, TC-18 (+ TC-10/11 details) | `tests/test_docs_cases.py` |

Additionally, `tests/test_ratelimit.py` covers the auth rate limits
(outside the TC-01…18 set).

Run the suite with `pytest` — tests default to a throwaway local SQLite file
and ignore the `DATABASE_URL` from `.env`, so they never touch a real database.

## Notes

- Auth: JWT bearer tokens (`POST /api/auth/login`). Admin-only routes use a
  role guard on the `users.is_admin` flag (ADMIN and USER share one table).
- Rate limiting: `POST /api/auth/login`, `POST /api/auth/register` and
  `PUT /api/users/{id}` (which also changes passwords) are limited per client
  IP with a sliding window (in-memory; returns `429` + `Retry-After`).
  Defaults: 5/min login, 10/min register, 10/min account update — tune or
  disable via the `RATE_LIMIT_*` settings in `.env`.
- Booking follows `docs/componentlogic.md`: capacity check → booking or
  waitlist → payment for paid events → notifications.
- Cancelling a confirmed booking promotes the first waitlisted user.
- Certificates require the event to be `completed` and a non-cancelled
  registration; certificate numbers are unique.
- The payment gateway is an in-process stand-in (`app/services/payments.py`);
  replace `_call_gateway` and wire `POST /api/payments/callback` to your
  provider's webhook.
