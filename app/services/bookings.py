"""Booking service: the documented end-to-end booking flow.

User selects event -> validate user -> event exists? -> capacity check ->
seat available: create + confirm booking (payment if required) |
event full: add to waitlist with position -> waitlist confirmation.
Cancellations promote the next waitlisted user.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.registration import Registration
from app.models.waitlist import Waitlist
from app.services.notifications import send_notification
from app.services.payments import event_fee, initiate_payment


class BookingError(Exception):
    pass


def confirmed_count(db: Session, event_id: int) -> int:
    return (
        db.query(func.count(Registration.id))
        .filter(
            Registration.event_id == event_id,
            Registration.status == "confirmed",
        )
        .scalar()
        or 0
    )


def next_waitlist_position(db: Session, event_id: int) -> int:
    current_max = (
        db.query(func.max(Waitlist.position))
        .filter(Waitlist.event_id == event_id, Waitlist.status == "waiting")
        .scalar()
    )
    return (current_max or 0) + 1


def book_event(db: Session, user_id: int, event_id: int) -> Registration | Waitlist:
    """Create a booking or add the user to the waitlist, per capacity rules.

    Returns the Registration (status pending + payment when required) or the
    Waitlist entry, so the router can shape the response.
    """
    event = db.get(Event, event_id)
    if event is None:
        raise BookingError("Event not found")
    if event.status != "scheduled":
        raise BookingError(f"Event is not open for booking (status={event.status})")

    duplicate = (
        db.query(Registration)
        .filter(
            Registration.user_id == user_id,
            Registration.event_id == event_id,
            Registration.status.in_(["pending", "confirmed"]),
        )
        .first()
    )
    if duplicate is not None:
        raise BookingError("User is already registered for this event")

    if confirmed_count(db, event_id) < event.capacity:
        registration = Registration(user_id=user_id, event_id=event_id, status="pending")
        db.add(registration)
        db.flush()

        # Payment required for paid events; the simulated gateway charges a
        # flat demo fee when the event was created with a fee.
        fee = event_fee(event)
        if fee > Decimal("0"):
            initiate_payment(db, registration)

        registration.status = "confirmed"
        db.flush()

        send_notification(
            db,
            user_id,
            f"Booking confirmed for event '{event.event_name}'.",
            type_="booking",
        )
        return registration

    # Event full -> offer/add user to waitlist with a valid position.
    existing_entry = (
        db.query(Waitlist)
        .filter(Waitlist.user_id == user_id, Waitlist.event_id == event_id)
        .first()
    )
    if existing_entry is not None:
        if existing_entry.status in ("waiting", "promoted"):
            # Reclicking "Join waitlist" is a no go, not an error.
            return existing_entry
        # A previously removed/expired entry revives with a fresh position.
        existing_entry.status = "waiting"
        existing_entry.position = next_waitlist_position(db, event_id)
        db.flush()
        send_notification(
            db,
            user_id,
            f"Event '{event.event_name}' is full. You are waitlisted at position "
            f"{existing_entry.position}.",
            type_="waitlist",
        )
        return existing_entry

    waitlist_entry = Waitlist(
        user_id=user_id,
        event_id=event_id,
        position=next_waitlist_position(db, event_id),
        status="waiting",
    )
    db.add(waitlist_entry)
    db.flush()

    send_notification(
        db,
        user_id,
        f"Event '{event.event_name}' is full. You are waitlisted at position "
        f"{waitlist_entry.position}.",
        type_="waitlist",
    )
    return waitlist_entry


def cancel_registration(db: Session, registration: Registration) -> Registration:
    """Cancel a booking and promote the next waitlisted user, if any."""
    if registration.status == "cancelled":
        raise BookingError("Registration is already cancelled")

    registration.status = "cancelled"

    event = db.get(Event, registration.event_id)
    next_in_line = (
        db.query(Waitlist)
        .filter(
            Waitlist.event_id == registration.event_id,
            Waitlist.status == "waiting",
        )
        .order_by(Waitlist.position.asc())
        .first()
    )
    if next_in_line is not None and event is not None:
        next_in_line.status = "promoted"
        promoted = Registration(
            user_id=next_in_line.user_id, event_id=next_in_line.event_id, status="confirmed"
        )
        db.add(promoted)
        db.flush()

        send_notification(
            db,
            next_in_line.user_id,
            f"A seat opened up for '{event.event_name}'. Your waitlist promotion "
            "is confirmed.",
            type_="waitlist",
        )
        send_notification(
            db,
            registration.user_id,
            f"Your booking for '{event.event_name}' has been cancelled.",
            type_="booking",
        )

    return registration


def join_waitlist(db: Session, user_id: int, event_id: int) -> Waitlist:
    """Direct waitlist join (POST /api/waitlist)."""
    event = db.get(Event, event_id)
    if event is None:
        raise BookingError("Event not found")

    existing = (
        db.query(Waitlist)
        .filter(
            Waitlist.user_id == user_id,
            Waitlist.event_id == event_id,
            Waitlist.status.in_(["waiting", "promoted"]),
        )
        .first()
    )
    if existing is not None:
        raise BookingError("User is already on the waitlist for this event")

    # A removed/expired row still owns the (user, event) unique key: revive it
    # instead of inserting a duplicate row.
    prior = (
        db.query(Waitlist)
        .filter(Waitlist.user_id == user_id, Waitlist.event_id == event_id)
        .first()
    )
    if prior is not None:
        prior.status = "waiting"
        prior.position = next_waitlist_position(db, event_id)
        entry = prior
    else:
        entry = Waitlist(
            user_id=user_id,
            event_id=event_id,
            position=next_waitlist_position(db, event_id),
        )
        db.add(entry)
    db.flush()

    send_notification(
        db,
        user_id,
        f"You joined the waitlist for '{event.event_name}' at position {entry.position}.",
        type_="waitlist",
    )
    return entry


def remove_from_waitlist(db: Session, entry: Waitlist) -> Waitlist:
    """DELETE /api/waitlist/{id}: remove and close the gap in positions."""
    if entry.status == "removed":
        raise BookingError("Waitlist entry is already removed")
    event_id = entry.event_id
    removed_position = entry.position

    entry.status = "removed"

    followers = (
        db.query(Waitlist)
        .filter(
            Waitlist.event_id == event_id,
            Waitlist.status == "waiting",
            Waitlist.position > removed_position,
        )
        .order_by(Waitlist.position.asc())
        .all()
    )
    for follower in followers:
        follower.position -= 1
    return entry
