"""Custom exceptions for the summarizer service."""

from src.models.schemas import ErrorCode


class SummarizerError(Exception):
    """Base exception for summarizer service errors.

    All custom exceptions should inherit from this class.
    """

    def __init__(self, message: str, code: ErrorCode = ErrorCode.UNKNOWN_ERROR):
        super().__init__(message)
        self.message = message
        self.code = code

    def __str__(self) -> str:
        return f"[{self.code.value}] {self.message}"


class TranscriptError(SummarizerError):
    """Exception for transcript-related errors.

    Raised when transcript cannot be fetched or is invalid.
    """

    pass


class LLMError(SummarizerError):
    """Exception for LLM-related errors.

    Raised when LLM calls fail or return invalid responses.
    """

    def __init__(self, message: str, code: ErrorCode = ErrorCode.LLM_ERROR):
        super().__init__(message, code)


class ProcessingError(SummarizerError):
    """Exception for general processing errors.

    Raised when video processing fails for non-specific reasons.
    """

    def __init__(self, message: str, code: ErrorCode = ErrorCode.UNKNOWN_ERROR):
        super().__init__(message, code)


class VideoValidationError(SummarizerError):
    """Exception for video validation errors.

    Raised when video doesn't meet requirements (too long, too short, etc.).
    """

    pass
