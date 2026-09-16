"""Event management endpoints (admin-guarded for CUD operations)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_user
from app.models.event import Event
from app.models.registration import Registration
from app.models.user import User
from app.models.waitlist import Waitlist
from app.schemas import EventCreate, EventOut, EventUpdate, EventWithCounts

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Event]:
    """List available events (optionally filter by status)."""
    query = db.query(Event)
    if status_filter is not None:
        query = query.filter(Event.status == status_filter)
    return list(query.order_by(Event.event_date.asc()).all())


@router.get("/{event_id}", response_model=EventWithCounts)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Event:
    """Retrieve event details including live booking counts."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    event.confirmed_bookings = (
        db.query(Registration)
        .filter(Registration.event_id == event_id, Registration.status == "confirmed")
        .count()
    )
    event.confirmed_bookings = int(event.confirmed_bookings)
    event.waitlist_count = int(
        db.query(Waitlist)
        .filter(Waitlist.event_id == event_id, Waitlist.status == "waiting")
        .count()
    )
    return event


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Event:
    """Create a new event (admin only)."""
    if payload.event_date is None:  # pragma: no cover - schema enforces this
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="date required")
    event = Event(
        admin_id=admin.id,  # authenticated admin wins over any supplied admin_id
        event_name=payload.event_name,
        description=payload.description,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        venue=payload.venue,
        capacity=payload.capacity,
        status=payload.status,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Event:
    """Update an existing event (admin only)."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    data = payload.model_dump(exclude_unset=True)
    if "capacity" in data and data["capacity"] < event.capacity:
        confirmed = (
            db.query(Registration)
            .filter(Registration.event_id == event_id, Registration.status == "confirmed")
            .count()
        )
        if data["capacity"] < confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Capacity cannot be lower than the number of confirmed bookings",
            )
    for field, value in data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> None:
    """Delete an event (admin only)."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(event)
    db.commit()
