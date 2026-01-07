# Error Handling & Logging Patterns

Custom exceptions, handlers, structured logging, and monitoring.

---

## Custom Exception Classes

### DO ✅

```python
from fastapi import status


class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "INTERNAL_ERROR",
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR")


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, status.HTTP_403_FORBIDDEN, "FORBIDDEN")


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status.HTTP_404_NOT_FOUND, "NOT_FOUND")


class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_409_CONFLICT, "CONFLICT")


class BusinessError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, "BUSINESS_ERROR")
```

### DON'T ❌

```python
# Generic exceptions
raise Exception("Something went wrong")

# HTTP exceptions in services
from fastapi import HTTPException
raise HTTPException(status_code=404)  # Service knows HTTP!

# Return error dicts
return {"success": False, "error": "Not found"}
```

---

## Exception Handlers

### DO ✅

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


def setup_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {"field": ".".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "details": errors,
                },
            },
        )

    @app.exception_handler(Exception)
    async def general_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # Log the error
        logger.exception("Unhandled exception")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                },
            },
        )
```

### DON'T ❌

```python
# Expose stack traces
return JSONResponse(
    status_code=500,
    content={"error": str(exc), "traceback": traceback.format_exc()},  # Security risk!
)

# Swallow exceptions
try:
    await risky_operation()
except Exception:
    pass  # Error lost forever!
```

---

## Structured Logging

### DO ✅

```python
import structlog
from structlog.stdlib import BoundLogger

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


# Usage in service
class OrderService:
    async def create(self, data: OrderCreate, user_id: str) -> Order:
        log = logger.bind(user_id=user_id, action="create_order")
        
        log.info("Creating order", item_count=len(data.items))

        try:
            order = await self._repo.create(data)
            log.info("Order created", order_id=order.id)
            return order
        except Exception:
            log.exception("Failed to create order")
            raise
```

### DON'T ❌

```python
# Unstructured logging
print(f"Creating order for user {user_id}")
print(f"Error: {error}")

# Missing context
logger.error("Something failed")  # What? Where? For whom?

# Logging sensitive data
logger.info(f"User logged in with password {password}")
```

---

## Request ID Middleware

### DO ✅

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # Bind to structlog context
        structlog.contextvars.bind_contextvars(request_id=request_id)
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        # Clear context
        structlog.contextvars.unbind_contextvars("request_id")
        
        return response


# Add to app
app.add_middleware(RequestIDMiddleware)
```

---

## Sentry Integration

### DO ✅

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration


def init_sentry() -> None:
    """Initialize Sentry error tracking."""
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.VERSION,
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
        ],
    )


# Add user context in middleware
@app.middleware("http")
async def sentry_context(request: Request, call_next):
    if hasattr(request.state, "user"):
        sentry_sdk.set_user({
            "id": request.state.user["sub"],
            "email": request.state.user.get("email"),
        })
    return await call_next(request)


# Capture in exception handler
@app.exception_handler(Exception)
async def handle_exception(request: Request, exc: Exception):
    if not isinstance(exc, AppError):
        sentry_sdk.capture_exception(exc)
    # ... rest of handler
```

---

## Retry Pattern

### DO ✅

```python
import asyncio
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    retryable_exceptions: tuple = (Exception,),
) -> T:
    """Execute with retry logic."""
    last_exception: Exception | None = None

    for attempt in range(max_retries):
        try:
            return await fn()
        except retryable_exceptions as e:
            last_exception = e
            
            if attempt == max_retries - 1:
                raise

            wait_time = delay * (backoff ** attempt)
            logger.warning(
                "Retrying after error",
                attempt=attempt + 1,
                max_retries=max_retries,
                wait_time=wait_time,
                error=str(e),
            )
            await asyncio.sleep(wait_time)

    raise last_exception  # Should never reach here


# Usage
result = await with_retry(
    lambda: external_api.call(data),
    max_retries=3,
    retryable_exceptions=(ConnectionError, TimeoutError),
)
```

---

## Error Response Schema

### DO ✅

```python
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[dict] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# Document in routes
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    responses={
        404: {"model": ErrorResponse, "description": "User not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def get_user(user_id: str) -> UserResponse:
    ...
```

---

## Quick Reference

| Exception | Status | When |
|-----------|--------|------|
| `ValidationError` | 400 | Invalid input format |
| `UnauthorizedError` | 401 | Missing/invalid auth |
| `ForbiddenError` | 403 | No permission |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Duplicate/constraint |
| `BusinessError` | 422 | Business rule violation |
| `AppError` | 500 | Unexpected error |

| Logging Rule | Implementation |
|--------------|----------------|
| Always structured | Use structlog |
| Always contextual | Bind request_id, user_id |
| Never log secrets | password, token, etc. |
| Log level by env | DEBUG in dev, INFO in prod |
