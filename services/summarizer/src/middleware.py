"""Request tracking middleware — delegates to shared llm-common package.

Re-exports from llm_common.middleware so existing imports
(e.g. ``from src.middleware import add_request_context_middleware``)
continue to work without changes.
"""

from llm_common.middleware import (  # noqa: F401
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    add_request_context_middleware,
)
