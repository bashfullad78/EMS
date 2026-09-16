"""CERTIFICATE entity (1 : 0..1 with REGISTRATION)."""
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    registration_id: Mapped[int] = mapped_column(
        ForeignKey("registrations.id"), unique=True, index=True
    )
    certificate_no: Mapped[str] = mapped_column(String(60), unique=True)
    issue_date: Mapped[date] = mapped_column(Date)
    # issued | revoked | draft
    status: Mapped[str] = mapped_column(String(20), default="issued")

    registration = relationship(
        "Registration", back_populates="certificate", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Certificate id={self.id} no={self.certificate_no!r}>"
