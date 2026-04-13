# Phase 5 — RAG Chat Concierge

**Status: Complete (core). Evolution to AI-first routing: in progress.**

---

## What Was Built

The concierge is live. Key capabilities delivered:

- Floating chat pill on every page, session persists across client-side navigation
- Redis-backed session state (conversation history + last watch cards + compare scope + session state, 1 h TTL)
- Watch card injection — Discovery results, compare pairs, and exact matches render as thumbnail cards
- Action chips — compare, search (Smart Search), navigate (brand/collection/watch pages), set_cursor, suggest
- Signed-in Watch DNA personalisation — behavior summary injected into AI context
- Rate limiting — 5 messages/day (production), unlimited (local dev), Redis INCR keyed by userId or IP
- Multi-language support — language detected from message content; retry pass on language drift
- Wikipedia web enrichment — brand/horology knowledge queries get a lightweight Wikipedia excerpt injected as secondary context
- Suggest chips on refusals and 0-card responses — 3 random example queries from a 14-entry curated bank

---

## Actual Architecture

```
Frontend ChatPanel
  │  POST /api/chat/message  { sessionId, message, behaviorSummary?, preferredLanguage? }
  ▼
ChatController.cs
  │  Rate limit check (Redis INCR, per-user or per-IP, midnight TTL)
  │  Load session: history, lastWatchCards, compareScope, sessionState  ← Redis
  ▼
ChatService.ResolveMessageAsync()          ← deterministic routing tree (C#)
  ├── IsAbusiveQuery           → canned refusal
  ├── IsGreetingQuery          → canned greeting (no AI call)
  ├── TryResolveCursorCommand  → set_cursor action (no AI call)
  ├── ResolveEntityMentionsAsync   → brand / collection slug lookup (DB)
  ├── TryResolveReferencedWatchesAsync  → ordinal / slug resolution from session cards
  ├── IsExplicitCompareQuery   → TryResolveCompareWatchesAsync → BuildCompareResolution
  ├── TryResolveContextualFollowUpAsync → BuildCardContinuationResolutionAsync (session cards)
  ├── HasWatchDomainSignal (WatchFinderService) / mentions.HasAny
  │     → hasWatchScope = true → continue routing
  │     → hasWatchScope = false:
  │           non-ASCII chars    → UseAi = true (non-English path)
  │           shopping intent    → BuildShoppingGuidanceResolutionAsync → FindWatchesAsync context
  │           otherwise          → hard C# refusal + 3 suggest chips        ← fragile gate
  ├── LooksLikeBrandHistoryRequest → brand AI path (web enrichment enabled)
  ├── LooksLikeExactWatchQuery     → exact watch resolution
  ├── LooksLikeDiscoveryRequest    → BuildDiscoveryResolutionAsync (FindWatchesAsync)
  └── fallback                     → UseAi = true, minimal context
  ▼
POST ai-service /chat  { query, context[], history[], responseLanguage?, allowWebEnrichment?, webQuery? }
  ├── CHAT_SYSTEM_PROMPT — scope, grounding, link format, action format, style
  ├── Context block injected as fake assistant turn
  ├── Language rule injected if responseLanguage set
  ├── Wikipedia enrichment injected if allowWebEnrichment + webQuery
  ├── history[] appended
  └── LLM completion (max_tokens=200, temp=0.3)
        → _extract_actions() strips ACTIONS: [...] line
        → _truncate_chat_response() / _cleanup_markdown_artifacts()
        → _inject_entity_links() links bare names using context slugs
        → _filter_internal_links() removes hallucinated paths
        → _filter_actions() validates action slugs/cursors against context
  ▼
BuildSuggestionActions()  → appends compare / search / navigate chips grounded in watch cards
Save to Redis: history, cards, compare_scope, session_state
Return ChatApiResponse { message, watchCards[], actions[] }
```

---

## What's Working Well

| Capability | Notes |
|---|---|
| Exact watch / brand / collection routing | DB slug lookup → precise context, no hallucination |
| Compare pairs | Two resolved slugs → structured compare context, compare chip |
| Ordinal references ("compare first and fourth") | Session card indexes, supports 1st–5th |
| Watch DNA personalisation | BehaviorSummary injected; AI surfaces style-relevant suggestions |
| Language handling | Response language pinned; retry pass if drift detected |
| Wikipedia enrichment | Brand/history queries get lightweight web notes without hallucination risk |
| Suggest chips on refusals | 3 random example queries guide users to valid concierge requests |
| Session continuity across navigation | Layout-level mount, sessionStorage-backed session ID |

---

## Current Limitation: C# Scope Gate

The `!hasWatchScope` gate in `ResolveMessageAsync` is the main brittleness point. It decides whether to call the AI at all using regex and keyword lists (`HasWatchDomainSignal`, `LooksLikeWatchShoppingIntent`). Every missed pattern requires a manual code patch:

- `"gift for my girlfriend"` → required adding `LooksLikeWatchShoppingIntent`
- `"something for a formal dinner"` → required fixing the regex to allow an intervening adjective
- `"yes please show me the details"` → required expanding `IsAffirmativeFollowUp`
- Brand acronyms (`PP`, `AP`, `VC`) → required a static `_brandAliases` dictionary

The AI's own system prompt already handles all of these correctly. The gate is redundant and fighting against the model.

---

## AI-First Routing — Complete

The `!hasWatchScope` C# scope gate has been removed. Deterministic fast paths (greeting, cursor, exact slug match, compare with resolved slugs) remain — they save AI calls and have zero ambiguity. Everything else routes directly to the AI.

### What was changed

**1. Removed the `!hasWatchScope` scope gate** (`backend/Services/ChatService.cs`)

```csharp
// Before: three separate branches — non-ASCII, shopping intent, hard refusal
if (!hasWatchScope)
{
    if (message.Any(c > 127)) { ... route to AI ... }
    if (LooksLikeWatchShoppingIntent(canonicalMessage)) { ... route to AI ... }
    return new ChatResolution { Message = UnsupportedQueryMessage, Actions = GetStaticSuggestions() };
}

// After: single early return — AI handles scope and emits suggest chips on refusals
if (!hasWatchScope)
    return new ChatResolution { UseAi = true, Query = message, Context = [] };
```

`LooksLikeWatchShoppingIntent` and `BuildShoppingGuidanceResolutionAsync` were deleted.

**2. AI emits suggest chips on its own refusals** (`ai-service/prompts/chat.py`)

Added to the Actions section — when the AI declines an out-of-scope request, it emits 3 suggest ACTIONS. The C# `GetStaticSuggestions()` fallback on the hard-refusal path is no longer needed. `BuildSuggestionActions` still handles the 0-card discovery path.

**3. Broadened contextual follow-up detection** (`ChatService.cs`)

```csharp
// Before: only bare affirmatives + "that one / those / these / them"
private static bool LooksLikeContextualFollowUp(string query) =>
    IsAffirmativeFollowUp(query)
    || Regex.IsMatch(query, @"\b(?:that one|those|these|them|...)\b", ...);

// After: ≤10 words + any conversational word → inject session context, let AI decide
private static bool LooksLikeContextualFollowUp(string query) =>
    query.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length <= 10
    && Regex.IsMatch(query,
        @"\b(?:yes|yeah|yep|sure|ok|okay|please|those|these|them|that|this|first|second|third|fourth|fifth|more|details|tell me|show me|compare|go ahead|sounds good|do it)\b",
        RegexOptions.IgnoreCase);
```

### What stays deterministic

| Path | Reason to keep |
|---|---|
| `IsGreetingQuery` → canned response | Saves an AI call; "hi" has no watch value |
| `TryResolveCursorCommand` | Unambiguous syntax; no language understanding needed |
| Brand/collection slug lookup + canonicalization | DB lookup must happen before context is built |
| Exact compare (two resolved slugs) | Structured action; AI involvement not needed for the routing decision |
| `IsAbusiveQuery` | Should never reach the AI |

### Why this works

The AI model already knows what Tourbillon's concierge scope is from the system prompt. "What is the weather" → the AI returns a polite decline and 3 suggest chips. "Gift for my girlfriend" → the AI routes to watch discovery naturally. Brand acronyms like "PP" → the AI resolves in context. None of these require C# regex.

C# builds context (DB lookups, session state injection, watch card assembly). The AI owns language understanding and intent classification.

---

## Token and Model Considerations

**Output token limit (130 words):** Controls response verbosity, not routing accuracy. Raising it makes answers longer; it does not fix missed shopping intent or affirmative follow-ups. Keep at 130 for the concise boutique voice.

**Input context:** Already sufficient. The AI receives the session watch cards, brand/collection slugs, history, and a language hint. The routing problems are upstream of the AI call — in the C# gate that sometimes prevents the call from happening at all.

**Model swap (Qwen local → Claude Haiku prod):** Haiku is noticeably better at following structured action output instructions and at natural language scope detection. The AI-first routing evolution benefits from Haiku more than Qwen. For local dev on Qwen, the broader pass-through may occasionally produce slightly weaker refusals, which is acceptable — the system prompt still governs.

**Web search:** Not needed for scope detection or intent classification. Wikipedia enrichment (already live) handles the "tell me the history of X" case well without a full search tool.

---

## Files

| File | Status | Notes |
|---|---|---|
| `backend/Services/ChatService.cs` | Complete | Scope gate removed; follow-up detection broadened |
| `backend/Controllers/ChatController.cs` | Complete | Rate limiting, session management |
| `ai-service/routes/chat.py` | Complete | Refusal suggest ACTIONS instruction live |
| `ai-service/prompts/chat.py` | Complete | Refusal suggest block in Actions section |
| `frontend/app/components/chat/ChatPanel.tsx` | Complete | Suggest chips, action chips, watch cards |
| `frontend/app/components/chat/ChatWidget.tsx` | Complete | Floating pill, slide-up panel |
| `frontend/contexts/ChatContext.tsx` | Complete | Session ID from sessionStorage |
| `frontend/lib/api.ts` | Complete | `sendChatMessage`, `clearChatSession`, `ChatAction` type |

---

## Verification

```bash
# After applying AI-first routing changes:

cd backend && dotnet build --no-restore 2>&1 | tail -5
cd backend.Tests && dotnet test --no-build 2>&1 | tail -5
cd frontend && npx tsc --noEmit 2>&1
make back   # rebuild container with C# changes
```

**Routing smoke test:**

| Query | Expected |
|---|---|
| `"hi"` | Canned greeting, no AI call |
| `"gift for my girlfriend"` | AI routes, returns watch cards |
| `"something for a formal dinner"` | AI routes, returns watch cards |
| `"PP Nautilus"` | AI resolves to Patek Philippe / Nautilus without brand alias code |
| `"what is the weather"` | AI politely declines + 3 suggest chips from AI |
| `"2 + 2"` | AI politely declines + 3 suggest chips from AI |
| `"yes please show me the details"` | Contextual follow-up using session cards |
| `"compare the first and fourth"` | Ordinal resolution from session state |
| `"tell me about Vacheron"` | Brand path, Wikipedia enrichment, VC collection chips |
