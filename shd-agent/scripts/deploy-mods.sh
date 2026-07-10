#!/usr/bin/env bash
set -euo pipefail

MODS_REPO_DIR="${MODS_REPO_DIR:-/opt/shd/deploy/lifesteal-mods}"
ACTIVE_MODS_DIR="${ACTIVE_MODS_DIR:-/opt/shd/lifesteal/server/mods}"
BACKUP_DIR="${MOD_BACKUP_DIR:-/opt/shd/lifesteal/backups/mods}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUP_DIR/mods-$STAMP.tar.gz"

mkdir -p "$ACTIVE_MODS_DIR" "$BACKUP_DIR"

git -C "$MODS_REPO_DIR" pull --ff-only

if ! find "$MODS_REPO_DIR" -maxdepth 1 -type f -name '*.jar' | grep -q .; then
  echo "No jar files found in $MODS_REPO_DIR" >&2
  exit 1
fi

tar -czf "$BACKUP" -C "$ACTIVE_MODS_DIR" .
find "$ACTIVE_MODS_DIR" -maxdepth 1 -type f -name '*.jar' -delete
find "$MODS_REPO_DIR" -maxdepth 1 -type f -name '*.jar' -exec cp {} "$ACTIVE_MODS_DIR/" \;

echo "$BACKUP"
