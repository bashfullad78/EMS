"""NOTIFICATION entity."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # email | sms | in_app | booking | payment | waitlist | certificate
    type: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    sent_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # sent | delivered | read | failed
    status: Mapped[str] = mapped_column(String(20), default="sent")

    user = relationship("User", lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Notification id={self.id} user={self.user_id} type={self.type}>"
