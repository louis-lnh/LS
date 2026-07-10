#!/usr/bin/env bash
set -euo pipefail

CONFIGS_REPO_DIR="${CONFIGS_REPO_DIR:-/opt/shd/deploy/lifesteal-configs}"
ACTIVE_CONFIG_DIR="${ACTIVE_CONFIG_DIR:-/opt/shd/lifesteal/server/config}"
BACKUP_DIR="${CONFIG_BACKUP_DIR:-/opt/shd/lifesteal/backups/configs}"
ALLOWLIST="${CONFIG_DEPLOY_ALLOWLIST:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUP_DIR/config-$STAMP.tar.gz"

if [ -z "$ALLOWLIST" ]; then
  echo "CONFIG_DEPLOY_ALLOWLIST is required. Refusing blind config deploy." >&2
  exit 1
fi

mkdir -p "$ACTIVE_CONFIG_DIR" "$BACKUP_DIR"
git -C "$CONFIGS_REPO_DIR" pull --ff-only
tar -czf "$BACKUP" -C "$ACTIVE_CONFIG_DIR" .

IFS=',' read -ra FILES <<< "$ALLOWLIST"
for file in "${FILES[@]}"; do
  trimmed="$(echo "$file" | xargs)"
  [ -z "$trimmed" ] && continue
  case "$trimmed" in
    /*|*..*) echo "Unsafe config path: $trimmed" >&2; exit 1 ;;
  esac
  mkdir -p "$ACTIVE_CONFIG_DIR/$(dirname "$trimmed")"
  cp "$CONFIGS_REPO_DIR/$trimmed" "$ACTIVE_CONFIG_DIR/$trimmed"
done

echo "$BACKUP"
