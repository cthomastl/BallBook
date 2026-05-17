import os
import uuid
import logging
from datetime import datetime, date, time
from typing import List, Optional

import httpx
import redis
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder

from app.models import (
    CreateBookingRequest,
    UpdateBookingStatusRequest,
    BookingResponse,
    BookingStatus,
    NotificationPayload,
)
from app.database import get_connection, release_connection

logger = logging.getLogger(__name__)
router = APIRouter()


def get_redis_client() -> redis.Redis:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return redis.from_url(redis_url, decode_responses=True)


def row_to_booking(row) -> BookingResponse:
    return BookingResponse(
        id=str(row["id"]),
        user_id=row["user_id"],
        trainer_id=row["trainer_id"],
        slot_id=row["slot_id"],
        date=row["date"],
        start_time=row["start_time"],
        end_time=row["end_time"],
        duration_minutes=row["duration_minutes"],
        status=BookingStatus(row["status"]),
        total_price=float(row["total_price"]) if row["total_price"] is not None else None,
        created_at=row["created_at"],
        notes=row["notes"],
    )


async def check_slot_availability(slot_id: str, booking_date: date) -> bool:
    search_url = os.getenv("SEARCH_SERVICE_URL", "http://localhost:3002")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{search_url}/search/slots/{slot_id}",
                params={"date": str(booking_date)}
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("available", False)
            return False
    except httpx.RequestError as e:
        logger.error(f"Search service unreachable: {e}")
        raise HTTPException(status_code=503, detail="Search service unavailable")


async def mark_slot_booked(slot_id: str, booking_id: str) -> bool:
    search_url = os.getenv("SEARCH_SERVICE_URL", "http://localhost:3002")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.patch(
                f"{search_url}/search/slots/{slot_id}/book",
                json={"booking_id": booking_id}
            )
            return response.status_code in (200, 204)
    except httpx.RequestError as e:
        logger.error(f"Failed to mark slot as booked: {e}")
        return False


async def release_slot(slot_id: str) -> bool:
    search_url = os.getenv("SEARCH_SERVICE_URL", "http://localhost:3002")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.patch(
                f"{search_url}/search/slots/{slot_id}/release"
            )
            return response.status_code in (200, 204)
    except httpx.RequestError as e:
        logger.error(f"Failed to release slot: {e}")
        return False


async def get_price(trainer_id: str, duration_minutes: int) -> Optional[float]:
    pricing_url = os.getenv("PRICING_SERVICE_URL", "http://localhost:3004")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{pricing_url}/pricing/calculate",
                params={"trainer_id": trainer_id, "duration_minutes": duration_minutes}
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("total_price")
            return None
    except httpx.RequestError as e:
        logger.warning(f"Pricing service unreachable, proceeding without price: {e}")
        return None


async def send_notification(payload: NotificationPayload):
    notification_url = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:3005")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{notification_url}/notifications/send",
                json=payload.model_dump()
            )
    except httpx.RequestError as e:
        logger.warning(f"Notification service unreachable: {e}")


# --------------------------------------------------------------------------- #
# Routes — static/prefixed paths MUST come before parameterised /{booking_id} #
# --------------------------------------------------------------------------- #

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "booking-service"}


@router.get("/user/{user_id}", response_model=List[BookingResponse])
async def get_user_bookings(user_id: str):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            rows = cur.fetchall()
    except Exception as e:
        logger.error(f"Database error fetching user bookings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bookings")
    finally:
        release_connection(conn)

    return [row_to_booking(row) for row in rows]


@router.get("/trainer/{trainer_id}", response_model=List[BookingResponse])
async def get_trainer_bookings(trainer_id: str):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE trainer_id = %s ORDER BY date ASC, start_time ASC",
                (trainer_id,)
            )
            rows = cur.fetchall()
    except Exception as e:
        logger.error(f"Database error fetching trainer bookings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bookings")
    finally:
        release_connection(conn)

    return [row_to_booking(row) for row in rows]


@router.post("/", response_model=BookingResponse, status_code=201)
async def create_booking(request: Request, body: CreateBookingRequest):
    redis_client = get_redis_client()
    lock_key = f"slot_lock:{body.slot_id}:{body.date}"
    lock_acquired = False

    try:
        lock_acquired = redis_client.set(lock_key, "locked", nx=True, ex=30)
        if not lock_acquired:
            raise HTTPException(
                status_code=409,
                detail="This slot is currently being booked by another user. Please try again."
            )

        is_available = await check_slot_availability(body.slot_id, body.date)
        if not is_available:
            raise HTTPException(status_code=409, detail="This slot is no longer available")

        total_price = await get_price(body.trainer_id, body.duration_minutes)

        conn = get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO bookings
                        (user_id, trainer_id, slot_id, date, start_time, end_time,
                         duration_minutes, status, total_price, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        body.user_id,
                        body.trainer_id,
                        body.slot_id,
                        body.date,
                        body.start_time,
                        body.end_time,
                        body.duration_minutes,
                        BookingStatus.CONFIRMED,
                        total_price,
                        body.notes,
                    )
                )
                row = cur.fetchone()
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error creating booking: {e}")
            raise HTTPException(status_code=500, detail="Failed to create booking")
        finally:
            release_connection(conn)

        booking = row_to_booking(row)

        await mark_slot_booked(body.slot_id, booking.id)

        notification = NotificationPayload(
            to_email=f"user_{body.user_id}@example.com",
            to_name=body.user_id,
            trainer_name=body.trainer_id,
            date=str(body.date),
            time=str(body.start_time),
            duration=body.duration_minutes,
            price=total_price,
            booking_id=booking.id,
            notification_type="BOOKING_CONFIRMED",
        )
        await send_notification(notification)

        return booking

    finally:
        if lock_acquired:
            redis_client.delete(lock_key)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: str):
    try:
        uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID format")

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,))
            row = cur.fetchone()
    except Exception as e:
        logger.error(f"Database error fetching booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch booking")
    finally:
        release_connection(conn)

    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")

    return row_to_booking(row)


@router.delete("/{booking_id}", status_code=200)
async def cancel_booking(booking_id: str):
    try:
        uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID format")

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Booking not found")

            if row["status"] == BookingStatus.CANCELLED:
                raise HTTPException(status_code=400, detail="Booking is already cancelled")

            cur.execute(
                "UPDATE bookings SET status = %s WHERE id = %s RETURNING *",
                (BookingStatus.CANCELLED, booking_id)
            )
            updated_row = cur.fetchone()
            conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error cancelling booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel booking")
    finally:
        release_connection(conn)

    booking = row_to_booking(updated_row)

    await release_slot(booking.slot_id)

    notification = NotificationPayload(
        to_email=f"user_{booking.user_id}@example.com",
        to_name=booking.user_id,
        trainer_name=booking.trainer_id,
        date=str(booking.date),
        time=str(booking.start_time),
        duration=booking.duration_minutes,
        price=booking.total_price,
        booking_id=booking.id,
        notification_type="BOOKING_CANCELLED",
    )
    await send_notification(notification)

    return {"message": "Booking cancelled successfully", "booking": jsonable_encoder(booking)}


@router.patch("/{booking_id}/status", response_model=BookingResponse)
async def update_booking_status(booking_id: str, body: UpdateBookingStatusRequest):
    try:
        uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking ID format")

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM bookings WHERE id = %s", (booking_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Booking not found")

            cur.execute(
                "UPDATE bookings SET status = %s WHERE id = %s RETURNING *",
                (body.status.value, booking_id)
            )
            updated_row = cur.fetchone()
            conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error updating booking status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update booking status")
    finally:
        release_connection(conn)

    return row_to_booking(updated_row)
