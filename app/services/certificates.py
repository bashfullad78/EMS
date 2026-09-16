"""Certificate service: eligibility check + generation + retrieval.

Documented rules: event must be completed; participant eligibility is
checked (here: a non-cancelled registration); unique certificate number.
"""
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.event import Event
from app.models.registration import Registration


class CertificateError(Exception):
    pass


def generate_certificate(db: Session, registration: Registration) -> Certificate:
    """Generate a certificate for an eligible registration of a completed event."""
    event = db.get(Event, registration.event_id)
    if event is None or event.status != "completed":
        raise CertificateError("Event is not completed; no certificate can be generated")
    if registration.status == "cancelled":
        raise CertificateError("Cancelled registrations are not eligible for certificates")

    existing = (
        db.query(Certificate).filter(Certificate.registration_id == registration.id).first()
    )
    if existing is not None:
        return existing

    certificate = Certificate(
        registration_id=registration.id,
        certificate_no=f"CERT-{uuid.uuid4().hex[:12].upper()}",
        issue_date=datetime.now().date(),
        status="issued",
    )
    db.add(certificate)
    db.flush()

    from app.services.notifications import send_notification

    send_notification(
        db,
        registration.user_id,
        f"Your certificate for '{event.event_name}' is available "
        f"({certificate.certificate_no}).",
        type_="certificate",
    )
    return certificate


def issue_for_completed_event(db: Session, event_id: int) -> list[Certificate]:
    """Batch-issue certificates for every eligible registration of an event."""
    event = db.get(Event, event_id)
    if event is None:
        raise CertificateError("Event not found")

    issued: list[Certificate] = []
    registrations = (
        db.query(Registration)
        .filter(
            Registration.event_id == event_id,
            Registration.status != "cancelled",
        )
        .all()
    )
    for registration in registrations:
        try:
            issued.append(generate_certificate(db, registration))
        except CertificateError:
            continue
    return issued
