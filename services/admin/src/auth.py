"""API key authentication middleware for admin service."""

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from src.config import settings

# Paths that never require authentication
EXEMPT_PATHS = {"/health"}

# Static SPA paths served without auth (exact match or prefix)
SPA_EXACT_PATHS = {"/", "/index.html"}
SPA_PREFIX_PATHS = ("/assets/",)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Checks Authorization: Bearer <ADMIN_API_KEY> on all non-exempt routes."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow health check and static SPA assets without auth
        if path in EXEMPT_PATHS or path in SPA_EXACT_PATHS:
            return await call_next(request)
        if any(path.startswith(p) for p in SPA_PREFIX_PATHS):
            return await call_next(request)

        # All other paths require Bearer token
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse({"error": "Missing Authorization header"}, status_code=401)

        token = auth[7:]
        if not hmac.compare_digest(token.encode(), settings.ADMIN_API_KEY.encode()):
            return JSONResponse({"error": "Invalid API key"}, status_code=401)

        return await call_next(request)
