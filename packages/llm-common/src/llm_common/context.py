"""ContextVars for propagating LLM tracking metadata through call stacks."""

from contextvars import ContextVar

llm_feature_var: ContextVar[str] = ContextVar("llm_feature", default="unknown")
llm_request_id_var: ContextVar[str | None] = ContextVar("llm_request_id", default=None)
llm_video_id_var: ContextVar[str | None] = ContextVar("llm_video_id", default=None)
