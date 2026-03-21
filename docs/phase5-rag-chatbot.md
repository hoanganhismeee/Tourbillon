# Phase 5 — RAG Chat Concierge

**Status: Planned (currently in Phase 3B)**

## Context

The project already has pgvector embeddings (351 watches), semantic query cache, and a Qwen 2.5 7B / Claude Haiku pipeline. This phase adds a floating chat assistant available on every page. It serves a distinct purpose from the Watch Finder — that feature returns a product grid from a vague prompt; this feature is conversational, product-aware, and handles both specific comparisons and brand knowledge questions.

**Two core query types:**
1. **Product recommendation** — "I like the Overseas and the Aquanaut, I go to the beach, which should I choose?" → structured analysis with specs + opinion + navigation links
2. **Brand/horological knowledge** — "Tell me the history of Vacheron" → web search + DB brand description → narrative + brand/collection page link

This is **separate** from Watch Finder (Phase 2). Watch Finder = discovery from a vague intent. Chat Concierge = informed conversation about specific watches, brands, or collections.

---

## What Already Exists (Reuse)

| Component | File | Reuse |
|---|---|---|
| Watch embeddings (351/351) | `WatchEmbeddingService.cs`, `WatchEmbeddings` table | Cosine search for relevant watch context |
| pgvector cosine search | `WatchFinderService.cs` | Copy vector search pattern |
| Semantic query cache | `QueryCacheService.cs` | Cache single-turn chat responses at cosine ≥ 0.92 |
| Claude/Qwen API calls | `ClaudeApiService.cs`, `ai-service/app.py` | Extend with chat method |
| Embedding endpoint | `ai-service` `POST /embed` | Same endpoint for query embedding |
| Rate limiting pattern | `PasswordChangeRateLimitService.cs` (IMemoryCache) | Copy for 5 msg/day limit |
| Brand/collection descriptions | `Brands`, `Collections` DB tables | Fetch for brand knowledge queries |
| Compare pill UI | `frontend/app/components/compare/CompareIndicator.tsx` | Match pill design; chat pill sits at bottom-8, compare sits at bottom-24 (above chat, only visible when active) |

---

## Architecture

```
User (floating pill, any page)
  ↓
POST /api/chat/message  { sessionId, message, history[] }
  ↓
ChatService.cs
  ├── Check rate limit: 5/day deployed, unlimited local (env-gated)
  ├── Embed user query → POST ai-service/embed
  ├── Check QueryCaches (cosine ≥ 0.92, only when history.length == 0) → return cached if hit
  ├── Detect query type:
  │     PRODUCT: collection name OR Watch.Description OR reference number (Watch.Name) found in query → fetch watch records + specs
  │     BRAND:   brand name in query (no specific model/collection) → fetch DB description
  │     GENERAL: neither → vector search watches (top 5 cosine)
  └── POST ai-service/chat { query, context, history, enableWebSearch }
        ↓
      ai-service /chat (Python, Qwen 2.5 7B local / Claude Haiku prod)
        ├── Tool: web_search (duckduckgo-search package, no API key)
        └── System prompt → structured response with markdown links
  ↓
Cache response in QueryCaches (only first-turn queries — history-dependent responses are not cached)
Return { message: string, watchCards: WatchCard[] }
  ↓
Frontend ChatWidget — renders markdown, watch thumbnail cards, clickable links
```

---

## Response Format by Query Type

### Product comparison response template
```
The [Overseas](/watches/42) is a sports-luxury piece built for active wear.
Its rubber strap, 150m water resistance, and 41mm steel case make it the natural
beach companion. The movement is in-house Cal. 5100 with a 5-day reserve.

Meanwhile, the [Aquanaut](/watches/17) shares the sporty DNA but leans more
casual-luxury — the textured rubber strap and checkered dial are distinctive,
though its 120m rating is slightly less robust.

My recommendation: the **Overseas**. Given daily beach and water use, the
extra water resistance margin and more formal after-hours versatility tip the
balance in its favour.

[Overseas](/watches/42) · [Aquanaut](/watches/17)
```
Frontend renders the final links as watch thumbnail cards (Cloudinary image, name, price).

### Brand knowledge response template
```
Vacheron Constantin, founded in 1755, is the world's oldest continuously
operating watchmaker...  [web search result blended with DB description]

You can explore Vacheron and its spectacular collections at
[Vacheron Constantin](/brands/2).
```

### Genuinely vague query (allowed hedge case)
If no watch names or brand context are present: "I like A and B, which should I buy?" with no other context → respond: "It depends on your style and use case — could you tell me more about how you'll wear it?"

---

## Phase 5 Components

### 1. ai-service — `/chat` endpoint

**File:** `ai-service/app.py` (extend existing)

- New route `POST /chat` accepting `{ query, context[], history[], enableWebSearch }`
- Web search: `duckduckgo-search` Python package (pip install, no API key required)
- System prompt (see below)
- Returns `{ message: string }` — links embedded as markdown in message text

**System prompt:**
```
You are a luxury watch concierge for Tourbillon. Give informed, opinionated advice.
When recommending or referencing a specific watch, always embed a markdown link:
  [Watch Name](/watches/{id})
For brands: [Brand Name](/brands/{id}). For collections: [Collection Name](/collections/{id}).
For product comparisons: structure as "The [A] is... Meanwhile [B] is... My recommendation: ..."
For brand knowledge questions: end with "Explore [Brand] and its collections at [Brand Page link]."
Keep responses under 200 words. Be direct. Only hedge with "it depends" when the user
provides no context about their use case.
```

**`ai-service/requirements.txt`:** add `duckduckgo-search`

### 2. Backend — `ChatController` + `ChatService`

**New files:**
- `backend/Controllers/ChatController.cs` — `POST /api/chat/message`, `DELETE /api/chat/session/{id}`
- `backend/Services/ChatService.cs` — orchestration pipeline
- `backend/Models/ChatSession.cs` — in-memory session (ConcurrentDictionary, no DB for MVP)

**Note:** In-memory session store does not persist across restarts or scale to multiple instances. Acceptable for MVP; upgrade to Redis or DB-backed sessions if horizontal scaling is needed.

**Rate limit (env-gated):**
```csharp
// appsettings.json
"ChatSettings": {
  "DailyLimit": 5,        // production
  "DisableLimitInDev": true  // local unlimited
}
```

Pattern: follow `PasswordChangeRateLimitService.cs` — `IMemoryCache` keyed by userId, sliding window reset at midnight.

**Query type detection in ChatService:**
1. Check query string against collection names in DB (case-insensitive) — catches "Nautilus", "Overseas", "Royal Oak" etc. which are collection-level comparisons, not individual watch references → PRODUCT query
2. Check against `Watch.Description` values (human-readable "Brand ModelName", e.g., "Vacheron Constantin Overseas Dual Time") → PRODUCT query
3. Check against `Watch.Name` (reference numbers, e.g., "5711/1A") — valid if the user pastes a ref number → PRODUCT query
4. Check against brand names only, with no collection/model match above → BRAND query
5. Fallback → vector search top-5 watches → GENERAL query

**Query cache note:** Only cache when `history.Length == 0` (first-turn, context-free queries). Multi-turn responses depend on session history and must not be cached.

### 3. Brand & Collection Embeddings

**Extend `WatchEmbeddingService.cs`** with brand/collection embed methods.

**New EF migration:** `BrandEmbeddings` table (brandId PK, embedding vector(768)) and `CollectionEmbeddings` (collectionId PK, embedding vector(768)).

**Admin endpoints:**
- `POST /api/admin/embeddings/brands` — embed all brand descriptions
- `POST /api/admin/embeddings/collections` — embed all collection descriptions
- `GET /api/admin/embeddings/status` — extend existing to include brand/collection counts

**Query cache pre-seeding:** Pre-seed ~30 common brand history and horological knowledge queries (e.g., "history of Patek Philippe", "what is a tourbillon") similar to the 115 watch-finder seeds. Add to existing seed endpoint or a new `POST /api/admin/query-cache/seed-chat`. Avoids first-user latency on common brand knowledge questions.

### 4. Frontend — Floating Chat Pill + Widget

**New files:**
- `frontend/components/ChatWidget.tsx` — pill button + slide-up panel
- `frontend/contexts/ChatContext.tsx` — messages, sessionId, isOpen state

**Pill design:** Match the existing `CompareIndicator` pill exactly (same height, font, border-radius, colour — dark brown glass, `#bfa68a` gold accents). Chat pill sits at `bottom-8 right-8` (always visible). Compare pill was moved to `bottom-24 right-8` and only appears when items are queued — it floats above the chat pill and never obscures it.

**Root layout integration:** `frontend/app/layout.tsx` — add `<ChatWidget />` alongside `<CompareIndicator />` inside providers.

**State persistence across page navigation:**

`ChatWidget` is mounted in `layout.tsx`. In Next.js App Router, the root layout is never unmounted during client-side (soft) navigation — only the page segment re-renders. This means `ChatContext` state (messages, isOpen) survives every in-app link click, including links embedded in chat responses like `/watches/42`.

Rules to preserve this:
- `sessionId` must be initialised from `sessionStorage`, not `useState(() => crypto.randomUUID())`. Generating via useState re-creates it on React Strict Mode double-mount in dev and on any future remount. Use `useEffect` + `sessionStorage.getItem/setItem` so the same ID is reused for the life of the browser tab.
- Do NOT add a `key` prop to `ChatWidget` or `ChatProvider` in the layout — a key forces a full remount on every render and would reset all state.
- Watch/brand links in assistant responses must render as Next.js `<Link>` (or plain `<a>`) — not `router.push` called imperatively — so navigation is a soft route change and the layout is not torn down.
- `isOpen` and `messages` live in React state inside `ChatContext`. They are not persisted to storage — a hard reload (F5) starts a fresh session, which is the correct behaviour. Only `sessionId` needs `sessionStorage`.

**Widget panel:**
- Message history with user/assistant bubbles
- Markdown rendering for assistant messages (add `react-markdown` if not present)
- Watch thumbnail cards rendered for any `/watches/:id` links detected in response (Cloudinary image + name + price)
- Usage indicator: "X of 5 messages today" (hidden in local dev / when limit disabled)
- Conversation survives all in-app navigation; cleared only on hard reload or explicit "clear" button

**`frontend/lib/api.ts`:** Add `sendChatMessage(sessionId, message, history)` and `clearChatSession(sessionId)`.

---

## Docs Updates

### `docs/ROADMAP.md`
- Add Phase 5 block: "RAG Chat Concierge"
- Status table additions:
  - `Chat Concierge — floating widget + product comparison RAG | Planned | 5`
  - `Chat Concierge — web search + brand knowledge answers | Planned | 5`
  - `Brand & Collection Embeddings | Planned | 5`
- AI Usage Limits table: update Chat Assistant row from 20 to **5 messages/user/day** (deployed); unlimited (local dev)
- Cost summary: Chat at 5 msg/day/user; note this is separate from Watch Finder quota
- Clarify distinction: Watch Finder = vague intent → product grid; Chat Concierge = conversational, specific watches/brands

### `README.md`
- Add "RAG Chat Concierge" to Core Features list
- Update Tech Stack if `duckduckgo-search` added

---

## File Change Summary

| File | Action |
|---|---|
| `ai-service/app.py` | Add `POST /chat` route + web_search tool + system prompt |
| `ai-service/requirements.txt` | Add `duckduckgo-search` |
| `backend/Controllers/ChatController.cs` | New |
| `backend/Services/ChatService.cs` | New |
| `backend/Models/ChatSession.cs` | New (in-memory session store) |
| `backend/Services/WatchEmbeddingService.cs` | Extend with brand/collection embed methods |
| `backend/Migrations/` | New migration: `BrandEmbeddings`, `CollectionEmbeddings` |
| `backend/Database/TourbillonContext.cs` | Add `DbSet<BrandEmbedding>`, `DbSet<CollectionEmbedding>` |
| `backend/Models/BrandEmbedding.cs` | New |
| `backend/Models/CollectionEmbedding.cs` | New |
| `frontend/components/ChatWidget.tsx` | New |
| `frontend/contexts/ChatContext.tsx` | New |
| `frontend/app/layout.tsx` | Add `<ChatWidget />` |
| `frontend/lib/api.ts` | Add chat API functions |
| `docs/ROADMAP.md` | Add Phase 5 + update tables |
| `README.md` | Add Chat Concierge to features |

---

## Verification

1. Start stack: `docker compose up` + `cd frontend && npm run dev`
2. Navigate to any page — Chat pill visible at bottom-right (`bottom-8`); add 2 watches to compare — Compare pill appears above it at `bottom-24`, no overlap
3. Open widget, ask: "I like the Overseas and the Aquanaut, I go to the beach, which should I choose?"
   - Expect: structured analysis with specs for both, clear recommendation, both watch names hyperlinked, thumbnail cards rendered
4. Ask: "Tell me about the history of Vacheron Constantin"
   - Expect: blended web+DB response, ends with link to `/brands/2`
5. Ask: "I like A and B, which should I buy?" (no context)
   - Expect: "it depends" + follow-up question
6. Send 6 messages (deployed env): 6th returns rate limit message; verify local dev has no limit
7. Run `cd backend && dotnet build --no-restore` — no errors
8. Run `cd frontend && npx tsc --noEmit` — no errors
9. Confirm brand/collection embeddings via `GET /api/admin/embeddings/status`
