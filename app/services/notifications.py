"""Notification service: create and persist notifications for system events.

Notification use cases documented: booking, payment, waitlist.
"""
from sqlalchemy.orm import Session

from app.models.notification import Notification


def send_notification(
    db: Session,
    user_id: int,
    message: str,
    type_: str = "in_app",
) -> Notification:
    """Generate, associate, send/store and status-track a notification."""
    notification = Notification(user_id=user_id, type=type_, message=message, status="sent")
    db.add(notification)
    return notification
