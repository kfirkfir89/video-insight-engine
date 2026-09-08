# Scheduler sidecar for scripts/backup.sh — replaces the dev-box crontab that
# only fired while the WSL VM was awake (docs/INFRASTRUCTURE.md "Scheduling").
#
# backup.sh runs `docker exec vie-mongodb mongodump` and curls Qdrant, so the
# container needs the docker CLI + the host's docker socket (mounted by
# compose), curl, jq and bash. busybox crond drives the schedule from
# scripts/backup-cron/crontab. Opt-in via `docker compose --profile backup`.
FROM alpine:3.20

RUN apk add --no-cache bash curl jq docker-cli tzdata coreutils findutils

COPY scripts/backup-cron/crontab /etc/crontabs/root

WORKDIR /repo
# -f: foreground, -l 8: log level (quiet), -L: log to stdout
CMD ["crond", "-f", "-l", "8", "-L", "/dev/stdout"]
