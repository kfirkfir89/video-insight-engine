"""Domain exceptions for the assistant service."""

from __future__ import annotations


class AppError(Exception):
    """Base exception for assistant service errors.

    All custom exceptions should inherit from this class.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: str = "INTERNAL_ERROR",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=404, code="NOT_FOUND")


class LLMError(AppError):
    """LLM provider error."""

    def __init__(self, message: str = "LLM provider error") -> None:
        super().__init__(message, status_code=502, code="LLM_ERROR")


class ValidationError(AppError):
    """Request validation error."""

    def __init__(self, message: str = "Validation error") -> None:
        super().__init__(message, status_code=400, code="VALIDATION_ERROR")


class ServiceUnavailableError(AppError):
    """External service unavailable."""

    def __init__(self, message: str = "Service unavailable") -> None:
        super().__init__(message, status_code=503, code="SERVICE_UNAVAILABLE")
