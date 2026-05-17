from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time, datetime
from enum import Enum
import uuid


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class CreateBookingRequest(BaseModel):
    user_id: str
    trainer_id: str
    slot_id: str
    date: date
    start_time: time
    end_time: time
    duration_minutes: int
    notes: Optional[str] = None


class UpdateBookingStatusRequest(BaseModel):
    status: BookingStatus


class BookingResponse(BaseModel):
    id: str
    user_id: str
    trainer_id: str
    slot_id: str
    date: date
    start_time: time
    end_time: time
    duration_minutes: int
    status: BookingStatus
    total_price: Optional[float]
    created_at: datetime
    notes: Optional[str]


class NotificationPayload(BaseModel):
    to_email: str
    to_name: str
    trainer_name: str
    date: str
    time: str
    duration: int
    price: Optional[float]
    booking_id: str
    notification_type: str
