"""Pydantic schemas (API contracts) for all components."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------- auth / users


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=40)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    contact_no: str | None
    registration_date: datetime
    status: str
    is_admin: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------- events


class EventCreate(BaseModel):
    # admin_id accepted for spec-compliance; the authenticated admin wins if they differ
    admin_id: int | None = None
    event_name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    event_date: date
    start_time: time
    end_time: time
    venue: str = Field(min_length=1, max_length=300)
    capacity: int = Field(gt=0)
    status: str = Field(default="scheduled", pattern="^(draft|scheduled|completed|cancelled)$")


class EventUpdate(BaseModel):
    event_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=300)
    capacity: int | None = Field(default=None, gt=0)
    status: str | None = Field(
        default=None, pattern="^(draft|scheduled|completed|cancelled)$"
    )


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: int
    event_name: str
    description: str | None
    event_date: date
    start_time: time
    end_time: time
    venue: str
    capacity: int
    status: str


class EventWithCounts(EventOut):
    confirmed_bookings: int
    waitlist_count: int


# -------------------------------------------------------------- registrations


class RegistrationCreate(BaseModel):
    user_id: int | None = None  # defaults to the authenticated user
    event_id: int


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    event_id: int
    booking_date: datetime
    status: str


# ------------------------------------------------------------------- waitlist


class WaitlistCreate(BaseModel):
    user_id: int | None = None  # defaults to the authenticated user
    event_id: int


class WaitlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    event_id: int
    position: int
    joined_date: datetime
    status: str


# ------------------------------------------------------------------- payments


class PaymentCreate(BaseModel):
    registration_id: int


class PaymentCallback(BaseModel):
    transaction_id: str
    # gateway-style result
    result: str = Field(pattern="^(success|failure|SUCCESS|FAILURE)$")


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration_id: int
    amount: Decimal
    payment_date: datetime | None
    status: str
    transaction_id: str | None


# --------------------------------------------------------------- notifications


class NotificationCreate(BaseModel):
    user_id: int
    type: str = Field(
        pattern="^(email|sms|in_app|booking|payment|waitlist|certificate)$"
    )
    message: str = Field(min_length=1)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    message: str
    sent_date: datetime
    status: str


# ----------------------------------------------------------------- certificates


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration_id: int
    certificate_no: str
    issue_date: date
    status: str


# --------------------------------------------------------------------- reports


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: int
    report_type: str
    generated_date: datetime
    report_data: dict[str, Any]
