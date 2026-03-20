# Tourbillon — AI Plan

## 1. Objective

AI is used only for natural language understanding, explanation, and content generation.
All core logic — filtering, sorting, scoring, wrist-fit calculation — is handled by the backend (SQL, .NET).

> AI enhances the system. It does not replace backend logic.

---

## 2. Model Strategy

### Production

| Property | Value |
| :--- | :--- |
| Model | Claude Haiku 4.5 |
| Provider | Anthropic API |
| Input cost | $0.25 / 1M tokens |
| Output cost | $1.25 / 1M tokens |
| Cost per query | ~$0.001 |

Used for: intent parsing, ranking explanation, content generation.

### Local Development

| Property | Value |
| :--- | :--- |
| Model | Qwen 2.5 7B Instruct |
| Runtime | Ollama |
| Cost | $0 |

Used for: prompt testing, API simulation, offline development.

**Key principle — develop on the deployment model.** Prompts written and tested against Qwen 2.5 7B (same capability tier as Haiku) will behave consistently in production. Developing on a stronger model hides prompt weaknesses that only surface after deployment.

### Environment Switch

The model endpoint is controlled by a single environment variable — no code changes needed between local and production:

```python
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY  = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL    = os.getenv("LLM_MODEL", "qwen2.5:7b")
```

---

## 3. AI Usage by Feature

### Must use AI

**Watch Finder + Concierge**
- Input: natural language query ("rose gold dress watch, thin, under 20k")
- AI call 1: parse intent into structured filters (material, price, style, size)
- Backend: query PostgreSQL with parsed filters
- AI call 2: rank results and generate match explanations
- Cost: ~$0.002/query (two Haiku calls)

**Story-first Product Pages**
- AI generates editorial content per watch: "Why This Watch Matters", "Collector Appeal", "Design Language", "Best For"
- Generated once, stored in DB, served statically — zero runtime cost after generation
- Cost: ~$0.001/watch, one-time

### Should use AI

**Compare Mode**
- Backend handles spec comparison (SQL)
- AI generates explanation of differences — wearability, brand character, fit
- AI call is optional, triggered only when user requests insight

**Watch DNA / Taste Profile**
- Phase A: rule-based clustering from interaction patterns (no AI cost)
- Phase B: optional embeddings via `all-MiniLM-L6-v2` local model (free)

**Discovery Pages**
- DB query handles watch filtering (e.g. `diameter < 38mm`)
- AI generates editorial intro per theme (~$0.001/page)
- Next.js SSG — generated once, static thereafter

### Never use AI

- Filtering (SQL)
- Sorting
- Wrist-fit calculation
- Product queries
- Authentication

---

## 4. Usage Limits

| Feature | Limit |
| :--- | :--- |
| Watch Finder | 5 searches / user / day |
| Compare Mode AI explanation | 10 / user / day |
| Chat Assistant | 20 messages / user / day |
| Story Content | Pre-generated — no runtime limit |
| Discovery Pages | Static — no runtime limit |

---

## 5. Caching Strategy

All AI responses are cached by normalised query key. A cache hit consumes no quota and makes no API call.

```
cache_key = normalize(user_query)
# lowercase, strip punctuation, expand synonyms (rose gold / RG / pink gold)
```

### Request flow

```
User request
    ↓
Check cache
    ↓
Hit  → return cached result        (no quota consumed, no API call)
Miss → check quota
    ↓
Allowed → call Claude Haiku → store in cache → consume quota
Denied  → fallback to standard search (no AI)
```

With caching, 100 requests for common queries (e.g. "dress watch under 10k") collapse to 1 API call.

---

## 6. Cost Estimation

| Scenario | Monthly cost |
| :--- | :--- |
| 1,000 users × 5 searches, no cache | ~$5 |
| Same, with cache (est. 50% hit rate) | ~$2–3 |
| Story Content (one-time, all watches) | ~$0.50 |
| Discovery Pages (one-time, ~20 pages) | ~$0.02 |
| **Total ongoing** | **< $5 / month** |

---

## 7. Infrastructure Cost (AWS)

| Service | Instance | Monthly |
| :--- | :--- | :--- |
| EC2 (backend + AI service) | t3.micro | $0 free tier / $7.59 after |
| RDS PostgreSQL | db.t3.micro | $0 free tier / $21.90 after |
| S3 (watch images, ~5GB) | Standard | ~$0.12 |
| CloudFront (CDN + SSL + WAF) | Free plan | $0 |
| Vercel (Next.js frontend) | Hobby | $0 |
| Claude Haiku API | — | ~$2–5 |
| Domain | — | ~$1 |
| **Total (free tier year)** | | **~$3–6 / month** |
| **Total (after free tier)** | | **~$40–45 / month** |

**t3.micro is sufficient for Tourbillon.** Without Selenium (scraping is complete), the idle memory footprint is approximately 560MB, leaving ~440MB of headroom. The rate-limited AI features protect against memory spikes from concurrent requests.

If memory consistently exceeds 800MB under real traffic, upgrade to t3.small ($15.18/month) — a two-minute change in the AWS console.

**RDS cost reduction option:** For a portfolio project, running PostgreSQL directly on the EC2 instance instead of RDS eliminates the ~$22/month RDS cost after free tier, bringing the total to ~$18/month.

---

## 8. Architecture

```
Frontend (Next.js — Vercel)
    ↓
Backend (.NET 8 API — EC2)
    ↓
AI Service (Python / Flask — same EC2 instance)
    ↓
Claude Haiku API (production) / Ollama Qwen 2.5 7B (local)
```

External services:
- PostgreSQL — RDS (or self-hosted on EC2)
- Amazon S3 + CloudFront — watch images
- Anthropic API — Claude Haiku

---

## 9. Pre-generation Jobs

Story Content and Discovery Pages are generated offline — never triggered at runtime by user requests.

```bash
# Run locally or as a one-time admin job
# Results stored in PostgreSQL, served as static data

python generate_story_content.py   # ~$0.50 total for all watches
python generate_discovery_pages.py # ~$0.02 total for all themes
```

Never run batch generation jobs on the production EC2 instance — this is the primary scenario that would push t3.micro past safe memory limits.

---

## 10. Response Parsing (defensive layer)

Both Haiku and Qwen can occasionally add conversational filler before JSON output. The AI service includes a cleaning and retry layer:

```python
import json, re

def parse_llm_json(raw: str) -> dict:
    # Strip preamble before the first { or [
    match = re.search(r'[\[{]', raw)
    if not match:
        raise ValueError("No JSON found in response")
    cleaned = raw[match.start():]
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise ValueError(f"Failed to parse JSON: {cleaned[:200]}")
```

On parse failure, the service retries once with a stricter prompt instructing the model to output only raw JSON with no preamble. On second failure, it returns a structured error so the backend can fall back to standard search.
