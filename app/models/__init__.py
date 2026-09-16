"""All ORM models; importing this package registers every table on Base.metadata."""
from app.models.certificate import Certificate
from app.models.event import Event
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.registration import Registration
from app.models.report import Report
from app.models.user import User
from app.models.waitlist import Waitlist

__all__ = [
    "Certificate",
    "Event",
    "Notification",
    "Payment",
    "Registration",
    "Report",
    "User",
    "Waitlist",
]
