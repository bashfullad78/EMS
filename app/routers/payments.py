"""Payment endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.payment import Payment
from app.models.registration import Registration
from app.models.user import User
from app.schemas import PaymentCallback, PaymentCreate, PaymentOut
from app.services.payments import PaymentError, handle_callback, initiate_payment

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    """Initiate payment for a booking."""
    registration = db.get(Registration, payload.registration_id)
    if registration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found"
        )
    if registration.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        payment = initiate_payment(db, registration)
    except PaymentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    """Retrieve the status of a payment."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    registration = db.get(Registration, payment.registration_id)
    if registration is None or (
        registration.user_id != current_user.id and not current_user.is_admin
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return payment


@router.post("/callback", response_model=PaymentOut)
def payment_callback(payload: PaymentCallback, db: Session = Depends(get_db)) -> Payment:
    """Receive the payment result from the payment gateway."""
    try:
        payment = handle_callback(db, payload.transaction_id, payload.result)
    except PaymentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    db.commit()
    db.refresh(payment)
    return payment
