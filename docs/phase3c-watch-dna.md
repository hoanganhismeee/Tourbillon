# Phase 3C: Watch DNA, Google OAuth, Email Magic Login

## Watch DNA / Taste Profile

### Overview

Registered users describe their watch taste in plain text (≤50 words). The AI service extracts structured preferences from that text. Those preferences drive a rule-based scoring function that re-orders the All Watches grid — preferred watches float to the top; unmatched watches keep the interleaved-by-brand shuffle in the tail.

Zero AI cost at browse time. The LLM is called exactly once when the user saves their taste.

---

### User-facing flow

1. Registered user navigates to **Edit Details** (`/account/edit-details`)
2. The **Watch DNA** section is at the top of the page (above personal details)
3. User types a free-text description: e.g. *"I like Vacheron dress watch 39-40mm"*
4. Live word count shows `X / 50 words`. Hard-coded note: *"Limit to 50 words to save model token, cause I'm broke"*
5. User clicks **Save My Taste** → loading spinner while AI processes (~2–5s)
6. After save: extracted preference chips appear: *"We understood: Vacheron Constantin · medium case"*
7. TanStack Query's `['tasteProfile']` key is invalidated → All Watches grid re-sorts immediately
8. Anonymous visitors see a CTA on the homepage below Watch Finder: *"Sign in to personalise your watch feed"*

---

### Scoring algorithm

Applied client-side in `AllWatchesSection.tsx` via `scoreTasteMatch()`. The same logic runs server-side in `TasteProfileService.ScoreWatch()` (C# static method, unit-tested).

| Signal | Points | Notes |
|---|---|---|
| Brand match | +3 | `watch.brandId` in `preferredBrandIds` |
| Case material | +2 | Substring match, case-insensitive |
| Dial color | +2 | Substring match, case-insensitive |
| Case size | +1 | `small` <37mm · `medium` 37–41mm · `large` >41mm |
| Price range | +1 | `currentPrice` within `[priceMin, priceMax]` — PoR watches (price=0) excluded |
| **Max** | **9** | |

Sort order: `matched` watches (score > 0) sorted DESC by score → `unmatched` (score = 0) interleaved by brand.

---

### LLM extraction pipeline

```
POST /api/taste { tasteText }
  → TasteController (50-word server-side validation)
  → TasteProfileService.ParseAndSaveAsync()
      → fetch all brand names from DB
      → POST ai-service /parse-taste { taste_text, available_brands }
          → TASTE_SYSTEM_PROMPT → LLM
          → JSON: { preferred_brands, preferred_materials, preferred_dial_colors,
                    price_min, price_max, preferred_case_size }
      → map brand names → brand IDs (case-insensitive DB lookup)
      → upsert UserTasteProfile row
  → return TasteProfileDto
```

**Architecture rule:** All prompt strings live in the `ai-service` Python package (currently `ai-service/prompts/`). The C# backend sends plain data and receives structured JSON — no prompt strings in C#.

---

### DB model — `UserTasteProfiles`

| Column | Type | Notes |
|---|---|---|
| Id | int PK | |
| UserId | int FK → AspNetUsers | Unique index |
| TasteText | text? | Raw input (pre-fills textarea on next visit) |
| PreferredBrandIds | text | JSON int[] default `[]` |
| PreferredMaterials | text | JSON string[] default `[]` |
| PreferredDialColors | text | JSON string[] default `[]` |
| PriceMin | numeric? | |
| PriceMax | numeric? | |
| PreferredCaseSize | text? | `"small"` / `"medium"` / `"large"` / null |
| UpdatedAt | timestamptz | |

Migration: `20260322010000_AddUserTasteProfile.cs`

---

### Key files

| File | Role |
|---|---|
| `backend/Models/UserTasteProfile.cs` | EF Core entity |
| `backend/DTOs/TasteProfileDto.cs` | Response DTO |
| `backend/DTOs/SaveTasteDto.cs` | Request DTO (TasteText, ≤50 words) |
| `backend/Services/TasteProfileService.cs` | LLM call, brand resolution, upsert, `ScoreWatch()` |
| `backend/Controllers/TasteController.cs` | GET + POST `/api/taste` |
| `ai-service/prompts/taste.py`, `ai-service/routes/taste.py` | `TASTE_SYSTEM_PROMPT` + `POST /parse-taste` |
| `frontend/lib/api.ts` | `TasteProfile`, `getTasteProfile`, `saveTasteProfile` |
| `frontend/app/account/edit-details/WatchDnaForm.tsx` | Textarea + word count + chips |
| `frontend/app/components/sections/AllWatchesSection.tsx` | `scoreTasteMatch()` + personalized sort |
| `frontend/app/components/TasteCTA.tsx` | Anonymous visitor CTA |
| `backend.Tests/Services/TasteProfileServiceTests.cs` | 12 ScoreWatch unit tests |

---

## Google OAuth

### Flow

```
Click "Continue with Google"
  → full browser navigation to GET /api/authentication/google
  → ASP.NET Challenge → Google accounts.google.com
  → User authenticates → Google redirects to /signin-google (OAuth middleware)
  → Middleware validates code, stores external login info in temporary cookie
  → Middleware redirects to GET /api/authentication/google-callback (controller)
  → Controller: GetExternalLoginInfoAsync() → email claim
      ├─ Email exists in DB → SignInAsync(existing user)
      └─ Email new → CreateAsync(passwordless User) → SignInAsync
  → Redirect to http://localhost:3000/auth/callback
  → auth/callback page calls login() → AuthContext refreshes → router.replace('/')
```

**Conflict resolution:** If a user registered with email + password, then tries Google with the same email, they are signed into their existing account. No duplicate user.

### Setup (user-secrets)

```bash
cd backend
dotnet user-secrets set "Authentication:Google:ClientId" "your-client-id"
dotnet user-secrets set "Authentication:Google:ClientSecret" "your-client-secret"
```

Google Cloud Console: add `http://localhost:5248/signin-google` to Authorised redirect URIs.

---

## Email Magic Login (passwordless OTP)

### Flow

```
Step 1 — Request:
  /login/magic → enter email → POST /api/authentication/magic-login/request
  → MagicLoginService.RequestAsync(): generate 6-char code, cache 10 min, email user
  → Always 200 (don't reveal if email exists)

Step 2 — Verify:
  Enter 6-box OTP → POST /api/authentication/magic-login/verify { email, code }
  → MagicLoginService.VerifyAsync(): lookup cache → match
      ├─ Match → remove code (one-time use) → find or create user → return User
      └─ No match / expired → return null → 401
  → SignInAsync → cookie → 200 OK
  → Frontend: login() → router.replace('/')
```

**Auto-create:** If email is new on verify, a minimal passwordless account is created. The user can add a password later via Edit Details.

**Code format:** 6-char uppercase alphanumeric. Excludes confusable characters: `0`, `O`, `1`, `I`, `L`. Charset: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.

### Key files

| File | Role |
|---|---|
| `backend/Services/MagicLoginService.cs` | Code generation, cache, email, find/create user |
| `backend/DTOs/MagicLoginDto.cs` | `MagicLoginRequestDto`, `MagicLoginVerifyDto` |
| `backend/Controllers/AuthenticationController.cs` | `POST /magic-login/request` + `/verify` |
| `frontend/lib/api.ts` | `requestMagicLogin`, `verifyMagicLogin` |
| `frontend/app/login/magic/page.tsx` | Two-step OTP UI |
| `frontend/app/auth/callback/page.tsx` | Post-OAuth / post-magic-login landing |
| `backend.Tests/Services/MagicLoginServiceTests.cs` | 4 cache + one-time-use tests |

