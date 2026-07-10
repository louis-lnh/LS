#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="${MINECRAFT_SERVER_DIR:-/opt/shd/lifesteal/server}"
BACKUP_ROOT="${BACKUP_DIR:-/opt/shd/lifesteal/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="$BACKUP_ROOT/full"
TARGET="$TARGET_DIR/lifesteal-full-$STAMP.tar.gz"

mkdir -p "$TARGET_DIR"

tar \
  --exclude="$SERVER_DIR/logs" \
  --exclude="$SERVER_DIR/crash-reports" \
  --exclude="$SERVER_DIR/cache" \
  -czf "$TARGET" \
  -C "$SERVER_DIR" \
  world world_nether world_the_end server.properties ops.json whitelist.json banned-players.json banned-ips.json config mods

find "$TARGET_DIR" -type f -name 'lifesteal-full-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$TARGET"
