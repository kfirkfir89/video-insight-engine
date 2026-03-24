# Error Handling & Logging

Custom exceptions, global handlers, structured logging, and monitoring.

<rules>
- ALWAYS define a base `AppError` class with `message`, `status_code`, and `code` fields, then subclass per error type (ad-hoc HTTPException calls scatter error formats across the codebase)
- ALWAYS register global exception handlers for `AppError`, `RequestValidationError`, and `Exception` (unhandled exceptions return raw stack traces to clients, leaking internal details)
- ALWAYS use structlog with bound context (request_id, user_id) for every log call (unstructured logs are unsearchable in production)
- ALWAYS log with context: who, what, why — never bare `logger.error("failed")` (contextless logs are useless for debugging)
- NEVER expose stack traces or internal paths in error responses (reveals implementation details attackers can exploit)
- NEVER use bare `except: pass` or `except Exception: pass` (silently swallowed errors cause data corruption that surfaces hours later)
- NEVER log secrets, passwords, tokens, or PII (log aggregators are often less secure than the application itself)
</rules>

---

## Exception Hierarchy

```python
class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.status_code = status_code
        self.code = code

class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400, "VALIDATION_ERROR")

class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, 404, "NOT_FOUND")

class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409, "CONFLICT")
```

Also define `UnauthorizedError(401)`, `ForbiddenError(403)`, and `BusinessError(422)`.

---

## Global Exception Handlers

Register on the FastAPI app. Return consistent `{success, error: {code, message}}` format.

```python
def setup_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def general_handler(request, exc):
        logger.exception("Unhandled exception")
        return JSONResponse(status_code=500, content={
            "success": False, "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
        })
```

---

## Structured Logging

Configure structlog with JSON output, timestamps, and log levels. Bind context at request boundaries.

```python
logger = structlog.get_logger()

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

---

## Request ID Middleware

Bind a unique request_id to every log entry via middleware. Use `structlog.contextvars` for propagation.

---

## Retry Pattern

```python
async def with_retry(
    fn: Callable[[], Awaitable[T]],
    max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0,
    retryable: tuple = (ConnectionError, TimeoutError),
) -> T:
    for attempt in range(max_retries):
        try:
            return await fn()
        except retryable as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(delay * (backoff ** attempt))
```

---

## Edge Cases

- **Pydantic validation vs domain validation**: `RequestValidationError` (422) is for malformed input. `BusinessError` (422) is for valid input that violates business rules. Handle them separately in exception handlers.
- **Logging in exception handlers**: Always `logger.exception()` for unhandled errors (includes stack trace). Use `logger.warning()` for expected domain errors.
- **Sentry integration**: Only capture non-AppError exceptions in Sentry. Domain errors are expected behavior, not bugs.

---

## Rules Summary

Define a base AppError hierarchy with consistent status codes. Register global handlers that return uniform error responses and never expose stack traces. Use structlog with bound context for every log call. Add request_id via middleware for request tracing. Use retry with exponential backoff for transient failures. Separate Pydantic validation errors from domain business errors. Log exceptions with full context but never log secrets.
