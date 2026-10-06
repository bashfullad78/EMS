"""Payment service: gateway interaction and status updates.

The gateway is an in-process stand-in implementing the documented flow:
send request -> receive response -> update status -> confirm or fail.
A real integration (Stripe, Razorpay, ...) replaces `_call_gateway`.
"""
import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.payment import Payment
from app.models.registration import Registration


class PaymentError(Exception):
    pass


def event_fee(event: Event) -> Decimal:
    """Demo pricing hook: flat fee when the event venue is tagged `paid:`.

    Keeps the payment path exercised without introducing a price column that
    the LLD does not define.
    """
    if event.venue and event.venue.lower().startswith("paid:"):
        try:
            return Decimal(event.venue.split(":", 1)[1])
        except Exception:
            return Decimal("0.00")
    return Decimal("0.00")


def _call_gateway(amount: Decimal) -> tuple[str, str]:
    """Simulated gateway call: returns (result, transaction_id)."""
    return "success", f"TXN-{uuid.uuid4().hex[:12].upper()}"


def initiate_payment(db: Session, registration: Registration) -> Payment:
    """Identify the booking, obtain amount, request and process the payment."""
    existing = (
        db.query(Payment).filter(Payment.registration_id == registration.id).first()
    )
    if existing is not None:
        raise PaymentError("Payment already exists for this registration")

    amount = event_fee(registration.event)
    payment = Payment(
        registration_id=registration.id, amount=amount, status="pending"
    )
    db.add(payment)
    db.flush()

    result, transaction_id = _call_gateway(payment.amount)
    payment.transaction_id = transaction_id

    if result == "success":
        payment.status = "completed"
        payment.payment_date = payment.payment_date or __import__("datetime").datetime.now()
    else:
        payment.status = "failed"

    return payment


def handle_callback(
    db: Session,
    transaction_id: str,
    result: str,
) -> Payment:
    """POST /api/payments/callback: update payment status from gateway response."""
    payment = (
        db.query(Payment).filter(Payment.transaction_id == transaction_id).one_or_none()
    )
    if payment is None:
        raise PaymentError(f"No payment found for transaction {transaction_id!r}")

    if result.lower() == "success":
        payment.status = "completed"
    else:
        payment.status = "failed"
    return payment
