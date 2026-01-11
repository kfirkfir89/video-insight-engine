"""Custom exceptions for the explainer service."""


class ExplainerError(Exception):
    """Base exception for explainer service errors.

    All custom exceptions should inherit from this class.
    """

    def __init__(self, message: str, code: str = "UNKNOWN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


class ResourceNotFoundError(ExplainerError):
    """Exception for resource not found errors.

    Raised when a requested resource (video summary, section, concept, etc.)
    cannot be found in the database.
    """

    def __init__(self, message: str, resource_type: str = "resource"):
        super().__init__(message, code="NOT_FOUND")
        self.resource_type = resource_type


class UnauthorizedError(ExplainerError):
    """Exception for authorization errors.

    Raised when user doesn't have access to a resource.
    """

    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(message, code="UNAUTHORIZED")


class LLMError(ExplainerError):
    """Exception for LLM-related errors.

    Raised when LLM calls fail or return invalid responses.
    """

    def __init__(self, message: str):
        super().__init__(message, code="LLM_ERROR")


class ValidationError(ExplainerError):
    """Exception for validation errors.

    Raised when input data is invalid.
    """

    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR")
