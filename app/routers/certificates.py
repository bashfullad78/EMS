"""Certificate endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.certificate import Certificate
from app.models.registration import Registration
from app.models.user import User
from app.schemas import CertificateOut
from app.services.certificates import CertificateError, generate_certificate

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


@router.post("/issue/{registration_id}", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
def issue_certificate(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Certificate:
    """Generate a certificate for an eligible registration (owner or admin)."""
    registration = db.get(Registration, registration_id)
    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
        )
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        certificate = generate_certificate(db, registration)
    except CertificateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    db.commit()
    db.refresh(certificate)
    return certificate


@router.get("/{certificate_id}", response_model=CertificateOut)
def get_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Certificate:
    """Retrieve a certificate (owner of the underlying registration or admin)."""
    certificate = db.get(Certificate, certificate_id)
    if certificate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found"
        )
    registration = db.get(Registration, certificate.registration_id)
    if registration is None or (
        registration.user_id != current_user.id and not current_user.is_admin
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return certificate
