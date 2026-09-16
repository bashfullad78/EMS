"""Seed script: creates an admin, a few users and demo events.

Usage (with the venv active):
    python -m app.seed
"""
from datetime import date, timedelta

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app import models  # noqa: F401
from app.models.event import Event
from app.models.user import User


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@example.com").first() is not None:
            print("Database already seeded; nothing to do.")
            return

        admin = User(
            name="EMS Admin",
            email="admin@example.com",
            password_hash=hash_password("admin-password"),
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
                start_time="09:00",
                end_time="17:00",
                venue="Grand Hall, Tech Park",
                capacity=2,
                status="scheduled",
            ),
            Event(
                admin_id=admin.id,
                event_name="Paid Workshop: SQLAlchemy Deep Dive",
                description="Hands-on paid workshop.",
                event_date=future,
                start_time="10:00",
                end_time="14:00",
                venue="paid:49.99",  # flat demo fee hook used by the payment flow
                capacity=30,
                status="scheduled",
            ),
            Event(
                admin_id=admin.id,
                event_name="Retro Meetup (completed)",
                description="Already happened; certificates can be issued.",
                event_date=past,
                start_time="18:00",
                end_time="21:00",
                venue="Community Center",
                capacity=100,
                status="completed",
            ),
        ]
        db.add_all(events)
        db.commit()
        print("Seeded: 1 admin, 2 users, 3 events.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
