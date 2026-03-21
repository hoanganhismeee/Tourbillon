#!/usr/bin/env bash
# Pre-warm the QueryCacheService with ~197 queries.
#
# What this does:
#   Each query runs through the full AI pipeline (embed → vector search → LLM rerank)
#   on first run and stores the result in the PostgreSQL QueryCaches table. Subsequent
#   user searches with cosine similarity >= 0.92 to a cached query return instantly
#   (~200ms) without touching the LLM at all.
#
# When to run:
#   - After initial DB setup or after clearing the query cache
#   - After adding many new watches (embeddings change, cache may drift)
#   - Run once; results persist across Docker restarts (PostgreSQL-backed)
#
# How long it takes (local Ollama 7B model):
#   ~30s per cache miss (LLM rerank), ~0.2s per cache hit (repeat queries at end)
#   Estimated total: 90–120 minutes for all 197 queries on first run
#   Re-running after a full cache: ~1 minute (all hits)
#
# Usage:
#   bash scripts/seed_embeddings.sh
#   bash scripts/seed_embeddings.sh 2>&1 | tee scripts/seed_log.txt
#
# Requires: curl, backend running at localhost:5248

QUERIES=(
  # ── Suggested queries (shown on home page — must be cached first) ──────────
  # Suggested queries shown in UI

  "sports watch under 10000"
  "chronograph under 20000"
  "moonphase under 15000"
  "manual winding watch under 10000"
  "watch under 5000"
  "watch under 10000"
  "watch under 20000"

  # Use case
  "first watch"
  "first serious watch"
  "daily watch"
  "everyday watch"
  "wedding watch"
  "office watch"
  "travel watch"
  "one watch collection"
  "quiet luxury watch"
  "not flashy watch"

  # Feature / constraint
  "small wrist watch"
  "38mm watch"
  "38 to 40mm watch"
  "thin dress watch"
  "blue dial watch"
  "black dial dress watch"
  "leather strap watch"
  "bracelet watch"
  "manual winding"
  "automatic watch"
  "moonphase"
  "perpetual calendar"
  "tourbillon"
  "perpetual tourbillon"
  "date watch"

  # Regional / style intent
  "german watch under 15000"
  "swiss watch under 10000"
  "japanese watch under 10000"
  "dress watch for suit"
  "weekend watch"
  "collector watch under 30000"
  "best value watch"
  "best watch under 10000"

  # Alias-heavy variants
  "vc overseas"
  "pp nautilus"
  "jlc reverso"
  "gs spring drive"
  "ap royal oak"
  "go panomaticlunar"
)

TOTAL=0
COUNT=0
BATCH_START=$(date +%s%3N)

for QUERY in "${QUERIES[@]}"; do
  START=$(date +%s%3N)
  curl -s -X POST http://localhost:5248/api/watch/find \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$QUERY\"}" > /dev/null 2>&1
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  TOTAL=$((TOTAL + ELAPSED))
  COUNT=$((COUNT + 1))
  sleep 3
  CACHED=$(curl -s http://localhost:5248/api/admin/query-cache/status 2>/dev/null | grep -o '"cached":[0-9]*' | grep -o '[0-9]*')
  echo "[$COUNT/${#QUERIES[@]}] ${ELAPSED}ms | ${CACHED:-?} cached | $QUERY"
done

AVG=$((TOTAL / COUNT))
BATCH_END=$(date +%s%3N)
echo ""
echo "--- Done ---"
echo "$COUNT queries | avg ${AVG}ms | $(( (BATCH_END - BATCH_START) / 1000 ))s total | final cached: $(curl -s http://localhost:5248/api/admin/query-cache/status | grep -o '"cached":[0-9]*' | grep -o '[0-9]*')"
