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

from app.routers import notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting notification-service")
    log_file = os.getenv("LOG_FILE", "notifications.log")
    logger.info(f"Notifications will be logged to console and '{log_file}'")
    yield
    logger.info("Shutting down notification-service")


app = FastAPI(
    title="BallBook Notification Service",
    description="Handles email notifications for basketball session bookings (simulated via console logging)",
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

app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])


@app.get("/health")
async def root_health():
    return {"status": "healthy", "service": "notification-service"}
