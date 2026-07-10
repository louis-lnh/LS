#!/usr/bin/env bash
set -euo pipefail

SERVICE="${MINECRAFT_SERVICE_NAME:-lifesteal}"
HOST="${MINECRAFT_QUERY_HOST:-127.0.0.1}"
PORT="${MINECRAFT_QUERY_PORT:-25565}"
LOG_PATH="${MINECRAFT_LOG_PATH:-/opt/shd/lifesteal/server/logs/latest.log}"

systemctl is-active "$SERVICE"
timeout 2 bash -lc "</dev/tcp/$HOST/$PORT"
test -f "$LOG_PATH"

echo "ok"
