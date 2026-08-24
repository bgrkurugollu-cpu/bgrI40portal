#!/bin/bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO_DIR="/Users/bugrakurugollu/bgrI40portal"
BRANCH="main"
LOG_FILE="$HOME/Library/Logs/bgr-auto-deploy.log"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"; }

cd "$REPO_DIR"

git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

log "Yeni commit bulundu ($LOCAL -> $REMOTE), güncelleniyor..."
git pull origin "$BRANCH" >> "$LOG_FILE" 2>&1
docker compose up -d --build >> "$LOG_FILE" 2>&1
log "Deploy tamamlandı ($(git rev-parse HEAD))."
