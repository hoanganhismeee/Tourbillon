#!/usr/bin/env bash
# Generates story-first editorial content for all watch collections and exports to SQL.
#
# Temporarily overrides ai-service with gemma2:9b (same Docker network as backend),
# seeds editorial content, then restores qwen2.5:7b. No credentials required.
#
# Usage:
#   make seed-editorial
#   bash scripts/seed_editorial.sh

set -euo pipefail

BACKEND="http://localhost:5248"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_USER="${POSTGRES_USER:-tourbillon}"
DB_NAME="${DB_NAME:-tourbillon}"
DB_PASS="${POSTGRES_PASSWORD:-}"

# Build compose command — same GPU detection as Makefile
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
  COMPOSE_BASE="docker compose -f $ROOT_DIR/docker-compose.yml -f $ROOT_DIR/docker-compose.nvidia.yml"
else
  COMPOSE_BASE="docker compose -f $ROOT_DIR/docker-compose.yml"
fi
COMPOSE_EDITORIAL="$COMPOSE_BASE -f $ROOT_DIR/docker-compose.editorial.yml"

# Restore qwen2.5:7b on exit (even on error)
cleanup() {
  echo ""
  echo "[cleanup] Restoring qwen2.5-7b..."
  $COMPOSE_BASE up -d ai-service 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Swap ai-service to gemma2:9b ──────────────────────────────────────

echo ""
echo "[1/3] Swapping ai-service to gemma2:9b (same network as backend)..."
echo "      First run pulls ~5.5 GB — subsequent runs skip the pull."
$COMPOSE_EDITORIAL up -d --build ai-service

echo "      Waiting for gemma2:9b to be ready..."
until docker inspect --format='{{.State.Health.Status}}' gemma2-9b 2>/dev/null | grep -q "healthy"; do
  printf "."
  sleep 5
done
echo " ready."

# ── Step 2: Seed editorial content ────────────────────────────────────────────

echo ""
echo "[2/3] Seeding editorial content (~51 collections)..."
SEED_START=$(date +%s)

HTTP_STATUS=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" \
  -X POST "$BACKEND/api/admin/editorial/seed" \
  -H "Content-Type: application/json")
SEED_RESPONSE=$(cat /tmp/seed_response.json)

SEED_END=$(date +%s)
echo "      HTTP $HTTP_STATUS — Response: $SEED_RESPONSE"
echo "      Completed in $(( SEED_END - SEED_START ))s"

STATUS=$(curl -s "$BACKEND/api/admin/editorial/status")
echo "      Coverage: $STATUS"

# ── Step 3: Optional pg_dump via postgresql container ─────────────────────────

echo ""
echo "[3/3] Exporting editorial tables to SQL..."
OUTPUT="$SCRIPT_DIR/editorial_seed_$(date +%Y%m%d_%H%M%S).sql"
if docker exec -e PGPASSWORD="$DB_PASS" postgresql pg_dump -U "$DB_USER" \
  -t '"WatchEditorialContents"' \
  -t '"WatchEditorialLinks"' \
  "$DB_NAME" > "$OUTPUT" 2>/tmp/pg_dump_err.txt; then
  echo "      Saved: $OUTPUT"
  echo "      Import to prod: psql \$PROD_DB < $OUTPUT"
else
  echo "      pg_dump failed: $(cat /tmp/pg_dump_err.txt)"
  rm -f "$OUTPUT"
fi

echo ""
echo "--- Done. qwen2.5-7b restoring on exit. ---"
