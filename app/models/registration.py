"""REGISTRATION entity (junction of USER and EVENT)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Registration(Base):
    __tablename__ = "registrations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    booking_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # pending | confirmed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending")

    user = relationship("User", lazy="selectin")
    event = relationship("Event", back_populates="registrations", lazy="selectin")
    payment = relationship(
        "Payment", back_populates="registration", uselist=False, lazy="selectin"
    )
    certificate = relationship(
        "Certificate", back_populates="registration", uselist=False, lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Registration id={self.id} user={self.user_id} event={self.event_id}>"
