"""Reports endpoints (admin only)."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User
from app.schemas import ReportOut
from app.services import reports

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/events", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def event_report(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ReportOut:
    """Generate an event report (admin only)."""
    report = reports.generate_event_report(db, admin.id)
    db.commit()
    db.refresh(report)
    return report


@router.get("/registrations", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def registration_report(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ReportOut:
    """Generate a registration report (admin only)."""
    report = reports.generate_registration_report(db, admin.id)
    db.commit()
    db.refresh(report)
    return report
