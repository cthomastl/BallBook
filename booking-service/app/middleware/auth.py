import os
import httpx
import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

EXCLUDED_PATHS = {"/bookings/health", "/health"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"}
            )

        token = auth_header.split(" ", 1)[1]
        auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://localhost:3001")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{auth_service_url}/auth/verify",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code != 200:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid or expired token"}
                    )
                user_data = response.json()
                request.state.user = user_data
        except httpx.RequestError as e:
            logger.error(f"Auth service unreachable: {e}")
            return JSONResponse(
                status_code=503,
                content={"detail": "Authentication service unavailable"}
            )

        return await call_next(request)
