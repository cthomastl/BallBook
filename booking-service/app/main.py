import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from app.database import init_db
from app.middleware.auth import AuthMiddleware
from app.routers import bookings


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting booking-service, initializing database...")
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    yield
    logger.info("Shutting down booking-service")


app = FastAPI(
    title="BallBook Booking Service",
    description="Handles basketball session bookings with distributed locking",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)

app.include_router(bookings.router, prefix="/bookings", tags=["bookings"])


@app.get("/health")
async def root_health():
    return {"status": "healthy", "service": "booking-service"}
