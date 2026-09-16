"""WAITLIST entity."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Waitlist(Base):
    __tablename__ = "waitlists"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_waitlist_user_event"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    joined_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # waiting | promoted | expired | removed
    status: Mapped[str] = mapped_column(String(20), default="waiting")

    user = relationship("User", lazy="selectin")
    event = relationship("Event", back_populates="waitlist_entries", lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Waitlist id={self.id} user={self.user_id} event={self.event_id} pos={self.position}>"
