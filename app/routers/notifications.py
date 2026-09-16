"""Notification endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas import NotificationCreate, NotificationOut
from app.services.notifications import send_notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/{user_id}", response_model=list[NotificationOut])
def list_notifications(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    """Retrieve notifications for a user (owner or admin)."""
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return list(
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.sent_date.desc())
        .all()
    )


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_user),
) -> Notification:
    """Create/send a notification (admin/system use)."""
    notification = send_notification(
        db, payload.user_id, payload.message, type_=payload.type
    )
    db.commit()
    db.refresh(notification)
    return notification
