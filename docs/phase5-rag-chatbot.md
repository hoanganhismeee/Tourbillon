# Phase 5 - RAG Chat Concierge

**Status: Complete (core). Reliability refactor in progress under Phase 13.5.**

---

## What Was Built

The concierge is live. Key capabilities delivered:

- Floating chat pill on every page, session persists across client-side navigation
- Redis-backed session state with conversation history, last watch cards, compare scope, and follow-up state
- Watch card injection for discovery results, compare pairs, and exact matches
- Action chips for compare, search, navigate, set_cursor, and suggest
- Signed-in Watch DNA personalization via a compact behavior summary
- Rate limiting at 5 messages/day in production, unlimited in local dev
- Multi-language support with response-language retry on drift
- Limited brand-history web enrichment via lightweight secondary notes

---

## Current State

Current concierge flow:

```text
Frontend ChatPanel
  -> POST /api/chat/message
ChatController
  -> rate limit + Redis session load
ChatService
  -> deterministic routing, session-aware resolution, WatchFinder calls, card/action assembly
  -> ai-service /chat for wording when explanation helps
ai-service /chat
  -> grounded response composition
  -> legacy support for model-emitted ACTIONS via _extract_actions() and _filter_actions()
Frontend
  -> executes returned actions and renders watch cards
```

What already works well:

- Exact watch, brand, and collection routing
- Backend-resolved compare flows
- Ordinal references such as "compare the first and fourth"
- Recommendation revision and rejection memory
- Watch DNA-aware concierge copy
- Preferred-language handling
- Brand-history enrichment that stays secondary to catalogue facts

---

## Current Limitation

The weak point is not retrieval quality. The weak point is overlapping control flow:

- `ChatService` decides many concierge routes
- `WatchFinderService` parses search intent again for retrieval
- `ai-service /chat` can still emit text-based `ACTIONS`

That overlap makes feature triggering less reliable than the retrieval stack itself. The remaining legacy path is especially fragile because the model must decide to emit actions, format them correctly, and survive backend filtering.

---

## Target State

Phase 13.5 moves the concierge to a simpler rule:

**Backend decides what the app does. ai-service writes the reply.**

Target flow:

```text
User message
  -> ChatService route classification
  -> WatchFinder/entity/session resolution
  -> backend-built watchCards + actions
  -> ai-service /chat for grounded wording only
  -> frontend executes backend-issued actions
```

Design rules:

- `ChatService` becomes the single orchestration authority for concierge behavior
- `WatchFinderService` remains the source of truth for search intent and catalogue retrieval
- Compare, search, navigate, and cursor actions are backend-issued
- `ai-service /chat` composes text for resolved context instead of deciding core feature triggering
- The frontend response shape stays the same: `message`, `watchCards`, `actions`

---

## Example Flows

Search request:

```text
User: "dress watch under 10k"
Backend: classify as Search -> call WatchFinderService -> build watch cards + Smart Search action
AI: explain the surfaced shortlist in concierge language
```

Compare request:

```text
User: "compare the Aquanaut and the Overseas"
Backend: resolve watches -> build compare action
AI: write the practical buying split
```

Entity info:

```text
User: "tell me about Vacheron Constantin"
Backend: resolve brand + collections -> build navigate chips
AI: write the brand overview from supplied context
```

Revision:

```text
User: "those are too sporty"
Backend: detect revision -> reuse prior discovery query + exclusions -> fetch revised shortlist
AI: explain the new direction only
```

Ordinal follow-up:

```text
User: "compare the first two"
Backend: resolve session cards by ordinal -> build compare action
AI: write the comparison copy
```

---

## Migration Plan

Phase 13.5 is the migration path:

1. Keep the current frontend contract: `message`, `watchCards`, `actions`
2. Move all core compare/search/navigation action generation into backend `ChatService`
3. Treat `ai-service /chat` as a composition endpoint for grounded wording
4. Remove legacy `_extract_actions()` and `_filter_actions()` from the critical path after rollout

---

## Files

| File | Role |
|---|---|
| `backend/Services/ChatService.cs` | Concierge orchestration and backend-issued action generation |
| `backend/Services/WatchFinderService.cs` | Search-intent source of truth |
| `backend/Controllers/ChatController.cs` | Session and rate-limit entrypoint |
| `ai-service/routes/chat.py` | Grounded response composition; legacy action parsing still present today |
| `ai-service/prompts/chat.py` | Concierge wording rules |
| `frontend/contexts/ChatContext.tsx` | Session, personalization, and action transport |
| `frontend/app/components/chat/ChatPanel.tsx` | Client-side execution of returned actions |
| `frontend/lib/api.ts` | Chat response contract |

---

## Verification

Use this doc together with the new Phase 13.5 roadmap entry:

- `docs/ROADMAP.md` - migration status and target architecture
- `docs/architecture.md` - high-level system ownership boundaries
- `docs/Basic Concepts.md` - conceptual rule: backend owns routing, AI owns wording
