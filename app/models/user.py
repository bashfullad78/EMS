"""USER and ADMIN entities (single table with role flag)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    contact_no: Mapped[str | None] = mapped_column(String(40), default=None)
    registration_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # active | inactive | suspended
    status: Mapped[str] = mapped_column(String(20), default="active")
    # true for ADMIN rows, false for plain USER rows
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r} admin={self.is_admin}>"
