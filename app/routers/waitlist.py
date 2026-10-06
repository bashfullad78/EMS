"""Waitlist endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.waitlist import Waitlist
from app.schemas import WaitlistCreate, WaitlistOut
from app.services import bookings
from app.services.bookings import BookingError

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def join_waitlist(
    payload: WaitlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Waitlist:
    """Add a user to an event waitlist and assign a valid position."""
    user_id = payload.user_id or current_user.id
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        entry = bookings.join_waitlist(db, user_id, payload.event_id)
    except BookingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/mine", response_model=list[WaitlistOut])
def list_my_waitlist_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Waitlist]:
    """List the current user's waitlist entries (used by the event page to
    show the user's position instead of a dead join button)."""
    return list(
        db.query(Waitlist)
        .filter(
            Waitlist.user_id == current_user.id,
            Waitlist.status.in_(["waiting", "promoted"]),
        )
        .order_by(Waitlist.joined_date.asc())
        .all()
    )


@router.get("/{entry_id}", response_model=WaitlistOut)
def get_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Waitlist:
    """View a waitlist entry (owner or admin)."""
    entry = db.get(Waitlist, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waitlist entry not found")
    if entry.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return entry


@router.delete("/{entry_id}", response_model=WaitlistOut)
def remove_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Waitlist:
    """Remove a user from the waitlist; closes the gap in positions."""
    entry = db.get(Waitlist, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waitlist entry not found")
    if entry.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        updated = bookings.remove_from_waitlist(db, entry)
    except BookingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    db.commit()
    return updated
