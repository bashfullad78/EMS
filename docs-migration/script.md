# Reproduction — SRC to DST migration

- **SRC** — existing EMS repository at `~/EMS`, data file `ems_dev.db` (SQLite)
- **DST** — `~/EMS-Destination` plus PostgreSQL cluster `18/emsd` on `127.0.0.1:5433`
- **Substrate** 

## 1. Destination system

```bash
# read only inspection of what exists
pg_lsclusters
ss -ltn | grep -E ':(5432|5433)\b'
free -h; df -h /
sudo -u postgres psql -p 5432 -Atc "select datname from pg_database where not datistemplate"

# create a separate cluster. 
# systemd's postgresql@.service maps '-' to '/' in %I, so "ems-dest" fails with
# "Assertion failed on job"; "emsd" starts normally.
sudo pg_createcluster 18 emsd --port 5433 --start

# role + database (SQL fed on stdin so the password never lands in argv)
PW=$(openssl rand -hex 16)
tmp=$(mktemp); chmod 600 "$tmp"
printf "CREATE ROLE ems_user LOGIN PASSWORD '%s';\nCREATE DATABASE ems_dest OWNER ems_user;\n" "$PW" > "$tmp"
sudo -u postgres psql -p 5433 -v ON_ERROR_STOP=1 -q < "$tmp"
rm -f "$tmp"

# DST configuration: new secrets, DST-only DSN
umask 077
cat > ~/EMS-Destination/.env <<EOF
DATABASE_URL=postgresql://ems_user:<generated-password>@127.0.0.1:5433/ems_dest
JWT_SECRET_KEY=$(openssl rand -hex 32)
ACCESS_TOKEN_EXPIRE_MINUTES=10
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_ALGORITHM=HS256
DB_ECHO_LOG=false
EOF
chmod 600 ~/EMS-Destination/.env
```

## 2. Transfer the software

```bash
rsync -a \
  --exclude='.git/' --exclude='venv/' --exclude='node_modules/' \
  --exclude='__pycache__/' --exclude='.pytest_cache/' \
  --exclude='*.db' --exclude='.env' \
  ~/EMS/ ~/EMS-Destination/
```

1.6 MB total. `frontend/dist` (540 KB, API base `http://localhost:8000`) is
reused, so no `npm install` is needed. The SRC virtualenv is used read-only as
the interpreter. No `.env`, `*.db`, `password.txt`, or key is copied.

## 3. Collect data (read-only)

```bash
SOURCE=~/EMS/ems_dev.db
sha256sum "$SOURCE"                        # recorded before and after
sqlite3 "$SOURCE" "select name from sqlite_master where type='table'"
```

Counts seen before migration:

| table | rows |
|---|---:|
| users | 3 |
| events | 3 |
| registrations | 1 |
| waitlists | 0 |
| payments | 0 |
| notifications | 1 |
| certificates | 0 |
| reports | 26 |

## 4. Migration job

Actual file: `~/EMS-Destination/migrate_data.py`. It is the only component that
writes data. Pseudocode:

```
open SRC SQLite read-only (mode=ro) and DST PostgreSQL from DST .env
create DST schema from the application's SQLAlchemy models

abort if DST already has rows                       # idempotency guard
abort if a source table has columns DST lacks

for table in users, events, registrations, waitlists, payments,
             notifications, certificates, reports:   # FK-safe order
    insert source rows with their original primary keys

for each table: setval(seq, max(id)+1, false)        # next id = max+1

verify per-table SRC == DST counts
verify zero orphan rows for every foreign key
exit 0 only if all checks pass
```

Run:

```bash
cd ~/EMS-Destination
~/EMS/venv/bin/python migrate_data.py    # prints PASS/FAIL per table
```

The first version used `setval(seq, max(id), false)`, which makes the next value
equal to `max(id)`, causing a duplicate-key 500 on the first new booking. Fixed
to `max(id)+1` and re-applied to all eight sequences; successful inserts during
UAT confirmed it.

## 5. Destination UAT

```bash
# 32 existing tests, isolated on SQLite (no DATABASE_URL exported)
cd ~/EMS-Destination
env -u DATABASE_URL ~/EMS/venv/bin/python -m pytest -q

# backend (DST .env is read from the current directory)
~/EMS/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# prebuilt UI (no node_modules)
python3 -m http.server 5173 --directory frontend/dist
```

| case | call | expected |
|---|---|---|
| startup | `GET /` | 200 |
| login | `POST /api/auth/login` alice | 200 + token |
| events | `GET /api/events` | 200, 3 rows |
| own bookings | `GET /api/users/{alice_id}/registrations` | 200 |
| book free seat | `POST /api/registrations` | **201**, `booked` |
| book paid seat | `POST /api/registrations` event 2 | **201**, payment `completed` |
| payment lookup | `GET /api/payments/{id}` | 200, `completed` |
| cancel | `DELETE /api/registrations/{id}` | 200 |
| user hits admin route | `GET /api/reports/events` as user | 403 |
| admin hits admin route | same as admin | **201** (creates a report row) |

## 6. Verification queries

```bash
cd ~/EMS-Destination
DSN=$(sed -n 's/^DATABASE_URL=//p' .env)
psql "$DSN" -Atc "select count(*) from users"     # repeat per table
psql "$DSN" -Atc "select count(*) from payments p
                  left join registrations r on p.registration_id = r.id
                  where r.id is null"              # 0 orphans
sha256sum ~/EMS/ems_dev.db                         # must equal the pre-run hash
```

## 7. Teardown (DST only)

```bash
sudo pg_ctlcluster 18 emsd stop
sudo pg_dropcluster 18 emsd --stop    # removes only the destination cluster
```

`18/main` on 5432 must stay untouched.

