"""PAYMENT entity (1 : 0..1 with REGISTRATION)."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    registration_id: Mapped[int] = mapped_column(
        ForeignKey("registrations.id"), unique=True, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    payment_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    # pending | completed | failed | refunded
    status: Mapped[str] = mapped_column(String(20), default="pending")
    transaction_id: Mapped[str | None] = mapped_column(String(120), default=None)

    registration = relationship(
        "Registration", back_populates="payment", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Payment id={self.id} reg={self.registration_id} status={self.status}>"
