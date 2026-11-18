# Destination UAT report — EMS on `18/emsd`

## 1. Test boundary

Every case below ran against DST only. SRC was opened read-only by the migration
job before testing and was not involved in the UAT. The pytest suite runs on a
throwaway SQLite file (`ems_test.db`) with `DATABASE_URL` unset, so it exercises
the same code without touching the DST PostgreSQL data. SRC and DST share one
machine; see `migration-report.md` §1 for the boundary.

## 2. Results

| Case | Check | Expected | Result | Evidence |
|---|---|---|---|---|
| UAT-01 | Application startup | `GET /` 200 | PASS | service/status JSON |
| UAT-02 | Existing user authentication | alice login 200 + token | PASS | seeded `alice@example.com` |
| UAT-03 | JWT identity | `GET /api/users/2` is alice | PASS | email returned matches |
| UAT-04 | Event retrieval | 3 events with counts | PASS | public list from DST |
| UAT-05 | Registration retrieval | alice's bookings | PASS | 3 at that point (migrated + UAT) |
| UAT-06 | New event registration | 201, `booked` | PASS | event 1, registration 4 |
| UAT-07 | Paid event booking | 201, booking + payment | PASS | event 2, bob, amount 49.99 |
| UAT-08 | Payment workflow (dummy gateway) | `completed` | PASS | transaction id; no real charge |
| UAT-08b | Payment retrieval | 200, `completed` | PASS | `GET /api/payments/{id}` as bob |
| UAT-09 | Registration cancellation | 200 | PASS | registration 4 cancelled |
| UAT-10 | Role guard — user denied | 403 | PASS | reports route as alice |
| UAT-11 | Admin authentication | 200 + token | PASS | DST admin credential (rotated) |
| UAT-12 | Role guard — admin allowed | 201 | PASS | report row created |
| UAT-13 | Existing automated tests | all pass | PASS | `32 passed` in 25.72 s |
| UAT-14 | Database integrity | counts match, 0 orphans | PASS | migration script + SQL checks |
| UAT-15 | Source comparison | SRC == DST (pre-UAT) | PASS | all 8 tables equal |

No FAIL or NOT TESTED cases. Earlier failed attempts are explained in §4; they
were harness or sequence-reset defects, not application behaviour.

## 3. Record counts

| Table | SRC | DST before UAT | DST after UAT |
|---|---:|---:|---:|
| users | 3 | 3 | 3 |
| events | 3 | 3 | 3 |
| registrations | 1 | 1 | 5 |
| waitlists | 0 | 0 | 0 |
| payments | 0 | 0 | 2 |
| notifications | 1 | 1 | 5 |
| certificates | 0 | 0 | 0 |
| reports | 26 | 26 | 27 |

Foreign-key orphans: 0 for all nine relationships. Post-UAT increases are the
UAT's own records; they are disclosed rather than deleted, because deleting rows
from the destination would be a destructive action.

## 4. Failures observed and corrections

1. First booking returned HTTP 500 (`registrations_pkey` duplicate). Cause:
   migration reset sequences to `max(id)` instead of `max(id)+1`. Fixed in
   `migrate_data.py`, reapplied `setval` to all eight sequences, re-ran the flow.
2. Harness treated `201 Created` as failure. The API is correct; harness fixed.
3. Harness posted a second payment for a booking that had already completed its
   payment (400 "Payment already exists"). Harness now verifies the payment
   returned by the booking and retrieves it by id.
4. Admin login failed because SRC's `password.txt` does not match SRC's dev-DB
   admin hash, and the harness first read the file incorrectly. Rotated the DST
   admin password via `app.seed --rotate-admin`; hash verified with bcrypt and
   login returned 200. SRC unchanged.

## 5. Evidence

| File | Shows |
|---|---|
| `screenshots/01-events-public.png` | public event list served from `18/emsd` |
| `screenshots/02-login.png` | sign-in page before authentication |
| `screenshots/03-bookings-alice.png` | alice's bookings from DST |
| `screenshots/04-events-signed-in.png` | authenticated event list |

Screenshots show collected data only.


