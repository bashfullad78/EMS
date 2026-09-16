"""Registration / booking endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.registration import Registration
from app.models.user import User
from app.models.waitlist import Waitlist
from app.schemas import RegistrationCreate, RegistrationOut, WaitlistOut
from app.services import bookings
from app.services.bookings import BookingError
from app.services.notifications import send_notification

router = APIRouter(prefix="/api/registrations", tags=["registrations"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_registration(
    payload: RegistrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Book a user for an event; waitlists automatically when the event is full."""
    user_id = payload.user_id or current_user.id
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        result = bookings.book_event(db, user_id, payload.event_id)
    except BookingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    if isinstance(result, Registration):
        return {
            "result": "booked",
            "registration": RegistrationOut.model_validate(result),
        }
    return {
        "result": "waitlisted",
        "waitlist": WaitlistOut.model_validate(result),
    }


@router.get("/{registration_id}", response_model=RegistrationOut)
def get_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Registration:
    """View a registration (owner or admin)."""
    registration = db.get(Registration, registration_id)
    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
        )
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return registration


@router.delete("/{registration_id}", response_model=RegistrationOut)
def cancel_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Registration:
    """Cancel a registration; promotes the next waitlisted user when applicable."""
    registration = db.get(Registration, registration_id)
    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
        )
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        updated = bookings.cancel_registration(db, registration)
    except BookingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    return updated


# Keep the user's bookings route also reachable under /api/users/{id}/registrations
users_bookings_router = APIRouter(prefix="/api/users", tags=["registrations"])


@users_bookings_router.get("/{user_id}/registrations", response_model=list[RegistrationOut])
def list_bookings_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Registration]:
    """View a user's bookings (owner or admin) - documented path /api/users/{id}/registrations."""
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return list(db.query(Registration).filter(Registration.user_id == user_id).all())
