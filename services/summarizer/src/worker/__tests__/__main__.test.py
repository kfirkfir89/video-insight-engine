"""Anchor for the worker entrypoint — the body is mostly aio-pika wiring,
end-to-end behaviour is verified by the docker-compose smoke test."""

from __future__ import annotations


def test_main_module_imports_and_exposes_main() -> None:
    from src.worker import __main__ as entry

    assert hasattr(entry, "main")
    assert hasattr(entry, "_declare_topology")
    assert hasattr(entry, "_redact_url")
    # Passwords must be redacted before being logged.
    redacted = entry._redact_url("amqp://user:secret@host:5672/")
    assert "secret" not in redacted
    assert "***" in redacted
