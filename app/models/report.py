"""REPORT entity (admin-generated analytical exports)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # revenue | attendance | event_summary | registration_summary
    report_type: Mapped[str] = mapped_column(String(40))
    generated_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # JSONB on PostgreSQL, JSON elsewhere (SQLite in tests/dev)
    report_data: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql")
    )

    admin = relationship("User", lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Report id={self.id} type={self.report_type}>"
