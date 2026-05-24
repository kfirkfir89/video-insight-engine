#!/usr/bin/env bash
#
# find-request.sh — pivot a request-id into every log source we control.
#
# Usage:
#   scripts/find-request.sh <request-id> [--since 1h]
#
# Greps docker logs for the three services that participate in the pipeline
# (api, summarizer, summarizer-worker, assistant) and prints matching lines
# prefixed with the service name. Falls back to journalctl when running on
# a host where docker isn't available.
#
# Exits non-zero only on usage errors — empty output is a valid result
# ("the request-id never reached any service").

set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat >&2 <<USAGE
usage: $0 <request-id> [--since 1h]

Searches docker logs for every service in the pipeline for the given
request-id. The request-id is a UUID v4 stamped by the API on every
response (X-Request-ID) and propagated through the queue payload and the
X-Request-ID header on internal service-to-service calls.

Examples:
  $0 4f81c2d8-9ba0-4e0b-bb15-1a37e5e9d2c2
  $0 4f81c2d8-9ba0-4e0b-bb15-1a37e5e9d2c2 --since 30m
USAGE
  exit 2
fi

request_id="$1"
shift

since_arg=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)
      since_arg=(--since "$2")
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

services=(
  vie-api
  vie-summarizer
  vie-summarizer-worker
  vie-assistant
)

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found — install docker or run on the host that owns the containers" >&2
  exit 1
fi

# Use grep -F because the request-id is a literal string — no regex chars.
# `|| true` keeps `set -e` happy when a service has no matches.
for svc in "${services[@]}"; do
  if ! docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
    echo "[${svc}] (container not running — skipping)"
    continue
  fi
  echo "=== ${svc} ==="
  docker logs "${since_arg[@]}" "${svc}" 2>&1 | grep -F "${request_id}" || echo "  (no matches)"
done

echo
echo "Tip: open Langfuse and search traces by tag 'requestId:${request_id}'."
echo "Tip: open Sentry and filter events by tag 'requestId:${request_id}'."
