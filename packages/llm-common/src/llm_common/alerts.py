"""Webhook delivery for llm_alerts.

Every alert written to the ``llm_alerts`` collection is also POSTed as JSON
to ``ALERT_WEBHOOK_URL`` (Slack-compatible generic webhook, ntfy, or any
HTTP catcher). Unset/empty URL → no-op, so dev and CI need no receiver.

Delivery is strictly best-effort: failures are logged and swallowed —
alerting must never break the LLM call it is reporting on. Uses stdlib
``urllib`` so llm-common gains no HTTP dependency; callers on an event loop
should wrap :func:`deliver_alert` in ``asyncio.to_thread``.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

import structlog

logger = structlog.get_logger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 3.0


def get_webhook_url() -> str:
    """Read the webhook target from the environment (empty → disabled)."""
    return os.environ.get("ALERT_WEBHOOK_URL", "").strip()


def deliver_alert(alert: dict) -> bool:
    """POST the alert document to ALERT_WEBHOOK_URL.

    Returns ``True`` only on a 2xx response. ``False`` for disabled webhook,
    non-2xx, or any transport failure — never raises.
    """
    url = get_webhook_url()
    if not url:
        return False
    # urllib.urlopen happily follows file:// and ftp:// — a misconfigured env
    # var must not turn the alerter into a local-file reader.
    scheme = urllib.parse.urlparse(url).scheme.lower()
    if scheme not in ("http", "https"):
        logger.warning("alert_webhook_invalid_scheme", scheme=scheme)
        return False
    try:
        # default=str keeps datetimes/ObjectIds from crashing serialization.
        body = json.dumps(alert, default=str).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT_SECONDS) as response:
            ok = 200 <= response.status < 300
        if ok:
            logger.info("alert_webhook_delivered", alert_type=alert.get("type"))
        else:
            logger.warning(
                "alert_webhook_rejected",
                alert_type=alert.get("type"),
                status=response.status,
            )
        return ok
    except Exception as e:  # noqa: BLE001 — alerting must never break the caller
        logger.warning("alert_webhook_delivery_failed", error=str(e))
        return False
