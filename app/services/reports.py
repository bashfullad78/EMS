"""Report service: generate and persist admin reports (event / registration)."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.payment import Payment
from app.models.registration import Registration
from app.models.report import Report


def generate_event_report(db: Session, admin_id: int) -> Report:
    total_events = db.query(func.count(Event.id)).scalar() or 0
    by_status = dict(
        db.query(Event.status, func.count(Event.id)).group_by(Event.status).all()
    )
    total_capacity = db.query(func.coalesce(func.sum(Event.capacity), 0)).scalar() or 0

    report = Report(
        admin_id=admin_id,
        report_type="event_summary",
        report_data={
            "total_events": total_events,
            "events_by_status": by_status,
            "total_capacity": int(total_capacity),
        },
    )
    db.add(report)
    db.flush()
    return report


def generate_registration_report(db: Session, admin_id: int) -> Report:
    total_registrations = db.query(func.count(Registration.id)).scalar() or 0
    by_status = dict(
        db.query(Registration.status, func.count(Registration.id))
        .group_by(Registration.status)
        .all()
    )
    revenue = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == "completed")
        .scalar()
        or 0
    )

    report = Report(
        admin_id=admin_id,
        report_type="registration_summary",
        report_data={
            "total_registrations": total_registrations,
            "registrations_by_status": by_status,
            "revenue": float(revenue),
        },
    )
    db.add(report)
    db.flush()
    return report
