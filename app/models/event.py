"""EVENT entity."""
from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    event_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    venue: Mapped[str] = mapped_column(String(300))
    capacity: Mapped[int] = mapped_column(Integer)
    # draft | scheduled | completed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="scheduled")

    registrations = relationship(
        "Registration", back_populates="event", lazy="selectin"
    )
    waitlist_entries = relationship(
        "Waitlist", back_populates="event", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Event id={self.id} name={self.event_name!r}>"
