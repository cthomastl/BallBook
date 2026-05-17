import os
import logging
from datetime import datetime
from typing import List, Optional, Dict
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory notification store: user_id -> list of notification records
_notification_history: Dict[str, List[dict]] = defaultdict(list)

LOG_FILE = os.getenv("LOG_FILE", "notifications.log")


class NotificationRequest(BaseModel):
    to_email: str
    to_name: str
    trainer_name: str
    date: str
    time: str
    duration: int
    price: Optional[float] = None
    booking_id: str
    notification_type: str


class BookingConfirmedRequest(BaseModel):
    to_email: str
    to_name: str
    trainer_name: str
    date: str
    time: str
    duration: int
    price: Optional[float] = None
    booking_id: str


class BookingCancelledRequest(BaseModel):
    to_email: str
    to_name: str
    trainer_name: str
    date: str
    time: str
    duration: int
    booking_id: str


def _price_str(price: Optional[float]) -> str:
    if price is None:
        return "N/A"
    return f"${price:.2f}"


def _format_notification(notification_type: str, data: dict) -> str:
    separator = "=" * 60
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    if notification_type == "BOOKING_CONFIRMED":
        body = (
            f"\n{separator}\n"
            f"  NOTIFICATION: BOOKING CONFIRMED\n"
            f"  Sent at:      {timestamp}\n"
            f"  To:           {data['to_name']} <{data['to_email']}>\n"
            f"{separator}\n"
            f"\n"
            f"  Dear {data['to_name']},\n"
            f"\n"
            f"  Your basketball session has been confirmed!\n"
            f"\n"
            f"  Booking Details:\n"
            f"    Booking ID:  {data['booking_id']}\n"
            f"    Trainer:     {data['trainer_name']}\n"
            f"    Date:        {data['date']}\n"
            f"    Time:        {data['time']}\n"
            f"    Duration:    {data['duration']} minutes\n"
            f"    Total Price: {_price_str(data.get('price'))}\n"
            f"\n"
            f"  See you on the court!\n"
            f"\n{separator}\n"
        )
    elif notification_type == "BOOKING_CANCELLED":
        body = (
            f"\n{separator}\n"
            f"  NOTIFICATION: BOOKING CANCELLED\n"
            f"  Sent at:      {timestamp}\n"
            f"  To:           {data['to_name']} <{data['to_email']}>\n"
            f"{separator}\n"
            f"\n"
            f"  Dear {data['to_name']},\n"
            f"\n"
            f"  Your basketball session has been cancelled.\n"
            f"\n"
            f"  Cancelled Booking Details:\n"
            f"    Booking ID:  {data['booking_id']}\n"
            f"    Trainer:     {data['trainer_name']}\n"
            f"    Date:        {data['date']}\n"
            f"    Time:        {data['time']}\n"
            f"    Duration:    {data['duration']} minutes\n"
            f"\n"
            f"  We hope to see you again soon. Book a new session anytime!\n"
            f"\n{separator}\n"
        )
    elif notification_type == "BOOKING_REMINDER":
        body = (
            f"\n{separator}\n"
            f"  NOTIFICATION: BOOKING REMINDER\n"
            f"  Sent at:      {timestamp}\n"
            f"  To:           {data['to_name']} <{data['to_email']}>\n"
            f"{separator}\n"
            f"\n"
            f"  Dear {data['to_name']},\n"
            f"\n"
            f"  This is a reminder for your upcoming basketball session!\n"
            f"\n"
            f"  Booking Details:\n"
            f"    Booking ID:  {data['booking_id']}\n"
            f"    Trainer:     {data['trainer_name']}\n"
            f"    Date:        {data['date']}\n"
            f"    Time:        {data['time']}\n"
            f"    Duration:    {data['duration']} minutes\n"
            f"    Total Price: {_price_str(data.get('price'))}\n"
            f"\n"
            f"  Don't forget to bring your gear!\n"
            f"\n{separator}\n"
        )
    else:
        body = (
            f"\n{separator}\n"
            f"  NOTIFICATION: {notification_type}\n"
            f"  Sent at:      {timestamp}\n"
            f"  To:           {data['to_name']} <{data['to_email']}>\n"
            f"{separator}\n"
            f"  Booking ID: {data['booking_id']}\n"
            f"  Trainer:    {data['trainer_name']}\n"
            f"  Date:       {data['date']} at {data['time']}\n"
            f"  Duration:   {data['duration']} minutes\n"
            f"\n{separator}\n"
        )

    return body


def _persist_to_file(formatted: str):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(formatted)
    except OSError as e:
        logger.warning(f"Could not write to log file '{LOG_FILE}': {e}")


def _store_in_memory(user_identifier: str, notification_type: str, data: dict):
    record = {
        "notification_type": notification_type,
        "booking_id": data["booking_id"],
        "to_email": data["to_email"],
        "to_name": data["to_name"],
        "trainer_name": data["trainer_name"],
        "date": data["date"],
        "time": data["time"],
        "duration": data["duration"],
        "price": data.get("price"),
        "sent_at": datetime.utcnow().isoformat(),
    }
    _notification_history[user_identifier].append(record)


def _dispatch(notification_type: str, data: dict):
    formatted = _format_notification(notification_type, data)
    logger.info(formatted)
    _persist_to_file(formatted)
    _store_in_memory(data["to_email"], notification_type, data)
    _store_in_memory(data.get("user_id", data["to_email"]), notification_type, data)


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "notification-service"}


@router.post("/send", status_code=200)
async def send_notification(request: NotificationRequest):
    valid_types = {"BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_REMINDER"}
    if request.notification_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid notification_type. Must be one of: {', '.join(valid_types)}"
        )

    data = request.model_dump()
    _dispatch(request.notification_type, data)

    return {
        "status": "sent",
        "notification_type": request.notification_type,
        "booking_id": request.booking_id,
        "to_email": request.to_email,
        "sent_at": datetime.utcnow().isoformat(),
    }


@router.post("/booking-confirmed", status_code=200)
async def booking_confirmed(request: BookingConfirmedRequest):
    data = request.model_dump()
    _dispatch("BOOKING_CONFIRMED", data)

    return {
        "status": "sent",
        "notification_type": "BOOKING_CONFIRMED",
        "booking_id": request.booking_id,
        "to_email": request.to_email,
        "sent_at": datetime.utcnow().isoformat(),
    }


@router.post("/booking-cancelled", status_code=200)
async def booking_cancelled(request: BookingCancelledRequest):
    data = request.model_dump()
    _dispatch("BOOKING_CANCELLED", data)

    return {
        "status": "sent",
        "notification_type": "BOOKING_CANCELLED",
        "booking_id": request.booking_id,
        "to_email": request.to_email,
        "sent_at": datetime.utcnow().isoformat(),
    }


@router.get("/history/{user_id}")
async def get_notification_history(user_id: str):
    history = _notification_history.get(user_id, [])
    return {
        "user_id": user_id,
        "total": len(history),
        "notifications": sorted(history, key=lambda x: x["sent_at"], reverse=True),
    }
