"""Tests for llm_common.context — ContextVar propagation."""

from llm_common.context import llm_feature_var, llm_request_id_var, llm_video_id_var


def test_feature_var_default():
    assert llm_feature_var.get() == "unknown"


def test_feature_var_set_get():
    token = llm_feature_var.set("summarize:chapter")
    assert llm_feature_var.get() == "summarize:chapter"
    llm_feature_var.reset(token)
    assert llm_feature_var.get() == "unknown"


def test_request_id_var_default():
    assert llm_request_id_var.get() is None


def test_video_id_var_default():
    assert llm_video_id_var.get() is None


def test_video_id_var_set():
    token = llm_video_id_var.set("vid-123")
    assert llm_video_id_var.get() == "vid-123"
    llm_video_id_var.reset(token)
