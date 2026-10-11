"""Seed script: creates an admin, a few users and demo events.
The seeded admin gets a strong random password.
Usage (with the venv active):

    python -m app.seed                   # seed a fresh database
    python -m app.seed --rotate-admin    # reset the admin password of an existing DB
"""
import secrets
import sys
from datetime import date, time, timedelta
from pathlib import Path

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app import models  # noqa: F401
from app.models.event import Event
from app.models.user import User

ADMIN_EMAIL = "admin@example.com"
PASSWORD_FILE = Path(__file__).resolve().parent.parent / "password.txt"


def _write_password_file(password: str) -> None:
    PASSWORD_FILE.write_text(
        "Seeded admin credentials:\n"
        f"email: {ADMIN_EMAIL}\n"
        f"password: {password}\n",
        encoding="utf-8",
    )
    PASSWORD_FILE.chmod(0o600)


def _ensure_admin_password() -> str:
    if PASSWORD_FILE.exists():
        for line in PASSWORD_FILE.read_text(encoding="utf-8").splitlines():
            if line.startswith("password:"):
                return line.split(":", 1)[1].strip()
    password = secrets.token_urlsafe(18)
    _write_password_file(password)
    return password


def rotate_admin_password() -> None:
   
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if admin is None:
            admin = db.query(User).filter(User.is_admin.is_(True)).order_by(User.id).first()
        if admin is None:
            print("No admin user found; run `python -m app.seed` first.")
            sys.exit(1)
        password = secrets.token_urlsafe(18)
        admin.password_hash = hash_password(password)
        db.commit()
        _write_password_file(password)
        print(f"Rotated admin password for {admin.email}; new credentials in {PASSWORD_FILE}")
    finally:
        db.close()


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == ADMIN_EMAIL).first() is not None:
            print("Database already seeded; nothing to do.")
            return

        admin_password = _ensure_admin_password()
        admin = User(
            name="EMS Admin",
            email=ADMIN_EMAIL,
            password_hash=hash_password(admin_password),
            contact_no="+1-555-0100",
            is_admin=True,
        )
        alice = User(
            name="Alice Attendee",
            email="alice@example.com",
            password_hash=hash_password("alice-password"),
            contact_no="+1-555-0101",
        )
        bob = User(
            name="Bob Attendee",
            email="bob@example.com",
            password_hash=hash_password("bob-password"),
            contact_no="+1-555-0102",
        )
        db.add_all([admin, alice, bob])
        db.flush()

        future = date.today() + timedelta(days=14)
        past = date.today() - timedelta(days=7)
        events = [
            Event(
                admin_id=admin.id,
                event_name="Python Conf 2026",
                description="A one-day conference on Python and FastAPI.",
                event_date=future,
                start_time=time(9, 0),
                end_time=time(17, 0),
                venue="Grand Hall, Tech Park",
                capacity=2,
                status="scheduled",
            ),
            Event(
                admin_id=admin.id,
                event_name="Paid Workshop: SQLAlchemy Deep Dive",
                description="Hands-on paid workshop.",
                event_date=future,
                start_time=time(10, 0),
                end_time=time(14, 0),
                venue="paid:49.99",  # flat demo fee hook used by the payment flow
                capacity=30,
                status="scheduled",
            ),
            Event(
                admin_id=admin.id,
                event_name="Retro Meetup (completed)",
                description="Already happened; certificates can be issued.",
                event_date=past,
                start_time=time(18, 0),
                end_time=time(21, 0),
                venue="Community Center",
                capacity=100,
                status="completed",
            ),
        ]
        db.add_all(events)
        db.commit()
        print(f"Seeded: 1 admin (credentials in {PASSWORD_FILE}), 2 users, 3 events.")
    finally:
        db.close()


if __name__ == "__main__":
    if "--rotate-admin" in sys.argv:
        rotate_admin_password()
    else:
        seed()
