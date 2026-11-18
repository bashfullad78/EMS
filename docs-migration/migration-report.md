## 1. System boundary

Two separate system instances were used. 

| | Source system | Destination system |
|---|---|---|
| Label used in this report | SRC | DST |
| Application copy | existing EMS repository (`~/EMS`) | `~/EMS-Destination` (separate tree, 1.6 MB) |
| Data store | SQLite file `ems_dev.db` | PostgreSQL 18 cluster `18/emsd`, database `ems_dest`, role `ems_user` |
| Endpoint | file, opened `mode=ro` | `127.0.0.1:5433` (separate from the pre-existing `18/main` on 5432) |
| Service | none (file) | `postgresql@18-emsd.service` with its own data directory `/var/lib/postgresql/18/emsd` |
| Credentials | existing source `.env`; not copied, and not used by DST | separate `.env`, mode 600, generated DB password and JWT secret |
| Lifecycle | untouched throughout | created, migrated into, tested, left running |

**Shared substrate:** the same kernel, installed
PostgreSQL 18 binaries, and the same operator account. The Python virtualenv was
reused read-only from SRC; the prebuilt frontend bundle was reused instead of a
fresh `npm install`.

**What this means:** SRC and DST are isolated application instances with separate
database processes, data directories, roles, ports, configuration, and
credentials. 

## 2. Work model

The only component that wrote data was a one shot migration job,
`migrate_data.py`, executing inside DST. SRC was opened read-only
(`sqlite:///file:…?mode=ro&uri=true`). Verification ran from DST against DST,
with SRC row counts read separately for comparison. The source database process
(`18/main`, port 5432) was inspected read-only and never restarted or changed.

## 3. Environment

| Item | Value |
| PostgreSQL | 18.6; clusters `18/main` (5432, pre-existing) and `18/emsd` (5433, new) |

## 4. Software transfer

`rsync` from SRC to DST excluded `.git`, `venv`, `node_modules`, `__pycache__`,
`.pytest_cache`, `*.db`, `.env`.
Required files (`app/`, `tests/`, `requirements.txt`, `frontend/`, prebuilt
`frontend/dist`) are present. DST received its own generated configuration.

## 5. Data migration

Script: `~/EMS-Destination/migrate_data.py` destination-emptiness guard,
schema compatibility check, FK-safe insert order, sequence reset, count and
orphan verification. Schema is created from the application's SQLAlchemy models,
so the destination app remains the schema owner.

### Counts before UAT

| Table | SRC | DST | Result |
|---|---:|---:|---|
| users | 3 | 3 | PASS |
| events | 3 | 3 | PASS |
| registrations | 1 | 1 | PASS |
| waitlists | 0 | 0 | PASS |
| payments | 0 | 0 | PASS |
| notifications | 1 | 1 | PASS |
| certificates | 0 | 0 | PASS |
| reports | 26 | 26 | PASS |

Foreign-key orphans: **0** across all nine relationships. Primary-key sequences
were reset to `max(id)+1`; this was proven by successful inserts during UAT.

### Counts after UAT (test artifacts)

users 3, events 3, registrations 5, waitlists 0, payments 2, notifications 5,
certificates 0, reports 27.

Four registrations (two cancelled), two dummy payments, the notifications those
bookings generated, and one report row created by the admin report endpoint.
No migrated row was altered or removed; the increase is additive test data.

## 6. Evidence of separation

| Check | Result |
|---|---|
| Two clusters, two ports | `18/main` 5432 online; `18/emsd` 5433 online |
| Separate data directories | `/var/lib/postgresql/18/main` vs `/var/lib/postgresql/18/emsd` |
| Separate roles | `ems_user` exists only in DST; `18/main` still holds its pre-existing `college_uploader` role |
| Separate configuration | SRC `.env` untouched; DST `.env` created new, mode 600 |
| Separate secrets | generated DST DB password and JWT secret; not present in SRC |
| Source read-only | source file SHA-256 identical before/after migration |
| Source tree unchanged | `git status` unchanged apart from this untracked `docs-migration/` |
| No shared schema | DST schema created by DST app; SRC schema untouched |

## 7. Corrections made (step 6b)

1. **DST cluster would not start.** `pg_createcluster 18 ems-dest` initialised the
   data directory, but systemd's `postgresql@.service` resolves `%I` for names
   containing dashes to a wrong path (`Assertion failed on job`). Renamed the
   still-empty cluster to `emsd` with `pg_renamecluster`; it then started. DST
   only; `18/main` was not touched.
2. **Duplicate primary key on the first new booking.** The migration reset
   sequences with `setval(seq, max(id), false)`, so `nextval` returned `max(id)`
   and `POST /api/registrations` failed with `registrations_pkey` duplicate.
   Changed to `max(id)+1`, re-applied to all eight sequences, re-ran UAT —
   passed.
3. **Destination admin credential.** SRC's `password.txt` does not match the
   admin hash stored in SRC's `ems_dev.db` (stale or from the hosted
   environment). Rotated the **DST** admin password with the application's own
   `app.seed --rotate-admin`, verified the bcrypt hash and a 200 login. SRC
   credentials untouched.
4. **UAT harness expectations.** DST returns `201` for registrations, payments,
   and report generation; the harness had expected `200`. Corrected the harness.
   No application change was required.

## 8. Security

- SRC `ems_dev.db` SHA-256 recorded before and after: unchanged.
- DST `.env` and `password.txt` are mode 600; no password, JWT secret, DSN, or
  token appears in this report, the UAT report, screenshots, or command output.
- No destructive SQL, no `TRUNCATE`/`DROP`, no writes to `18/main`, no cloud or
  billing changes, no real payment gateway.
- Authentication, authorization, and rate limiting stayed enabled throughout.

## 9. Artifacts

```
docs-migration/
  migration-report.md
  uat-report.md
  script.md
  screenshots/01-events-public.png
  screenshots/02-login.png
  screenshots/03-bookings-alice.png
  screenshots/04-events-signed-in.png
~/EMS-Destination/
  .env (600)
  migrate_data.py
```
## 10. Migration code 

Below is the migration code 

```
from __future__ import annotations

import sys

from sqlalchemy import MetaData, Table, create_engine, func, select, text
from sqlalchemy.engine import make_url

import app.models  # noqa: F401  (registers all tables on Base.metadata)
from app.core.config import settings
from app.core.database import Base, engine as dst_engine

SRC_PATH = "/home/notim-portant/EMS/ems_dev.db"
ORDER = [
    "users",
    "events",
    "registrations",
    "waitlists",
    "payments",
    "notifications",
    "certificates",
    "reports",
]
FK_CHECKS = [
    ("events", "admin_id", "users", "id"),
    ("registrations", "user_id", "users", "id"),
    ("registrations", "event_id", "events", "id"),
    ("waitlists", "user_id", "users", "id"),
    ("waitlists", "event_id", "events", "id"),
    ("payments", "registration_id", "registrations", "id"),
    ("notifications", "user_id", "users", "id"),
    ("certificates", "registration_id", "registrations", "id"),
    ("reports", "admin_id", "users", "id"),
]


def count(conn, table: Table) -> int:
    return conn.execute(select(func.count()).select_from(table)).scalar_one()


def main() -> int:
    if make_url(settings.DATABASE_URL).get_backend_name() != "postgresql":
        print("ABORT: destination DATABASE_URL is not PostgreSQL")
        return 2

    src_engine = create_engine(f"sqlite:///file:{SRC_PATH}?mode=ro&uri=true")
    Base.metadata.create_all(dst_engine)

    with src_engine.connect() as src, dst_engine.connect() as dst:
        src_tables = {n: Table(n, MetaData(), autoload_with=src) for n in ORDER}
        dst_tables = {n: Table(n, MetaData(), autoload_with=dst) for n in ORDER}

        non_empty = {n: count(dst, t) for n, t in dst_tables.items() if count(dst, t)}
        if non_empty:
            print(f"ABORT: destination already has rows: {non_empty}")
            return 2

        for n in ORDER:
            extra = {c.name for c in src_tables[n].columns} - {c.name for c in dst_tables[n].columns}
            missing = {c.name for c in dst_tables[n].columns} - {c.name for c in src_tables[n].columns}
            if extra or missing:
                print(f"ABORT: {n} column mismatch extra={sorted(extra)} missing={sorted(missing)}")
                return 2

        dst.rollback()  # close the read transaction opened by the guards
        with dst.begin():
            for n in ORDER:
                rows = [dict(r._mapping) for r in src.execute(select(src_tables[n]))]
                if rows:
                    dst.execute(dst_tables[n].insert(), rows)
                print(f"copied {n}: {len(rows)} rows")

            for n in ORDER:
                dst.execute(
                    text(
                        f"SELECT setval(pg_get_serial_sequence('{n}', 'id'), "
                        f"COALESCE((SELECT max(id) FROM {n}), 0) + 1, false)"
                    )
                )

    ok = True
    with src_engine.connect() as src, dst_engine.connect() as dst:
        print(f"\n{'table':<16}{'source':>8}{'dest':>8}  result")
        for n in ORDER:
            s = count(src, src_tables[n])
            d = count(dst, dst_tables[n])
            good = s == d
            ok &= good
            print(f"{n:<16}{s:>8}{d:>8}  {'PASS' if good else 'FAIL'}")

        print("\nforeign-key orphans")
        for child, col, parent, pcol in FK_CHECKS:
            n = dst.execute(
                text(
                    f"SELECT count(*) FROM {child} c LEFT JOIN {parent} p "
                    f"ON c.{col} = p.{pcol} WHERE c.{col} IS NOT NULL AND p.{pcol} IS NULL"
                )
            ).scalar_one()
            good = n == 0
            ok &= good
            print(f"{child}.{col} -> {parent}.{pcol}: {n}  {'PASS' if good else 'FAIL'}")

    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
```