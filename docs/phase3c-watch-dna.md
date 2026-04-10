# Phase 3C: Watch DNA, Google OAuth, Email Magic Login

## Watch DNA / Taste Profile

### Overview

Users can still describe their watch taste in plain text (≤50 words), but Watch DNA now lives primarily on `/trend`. The AI also produces a separate behavior analysis from recent browsing events. Manual taste remains durable; behavior analysis fills the gaps and explains the user's current direction.

Browse-time ranking stays zero-AI. The catalogue keeps a deterministic base order, then applies capped trend-led boosts so recent signals shape the opening rows without replacing the whole list.

---

### User-facing flow

1. Signed-in user opens **Trend** (`/trend`)
2. Watch DNA auto-runs behavior analysis on load via `POST /api/taste/generate`
3. While analysis runs, Trend shows a loading state instead of a manual regenerate button
4. When enough data exists, the behavior summary and extracted chips appear automatically
5. Users can still write a manual taste note; that save goes through `POST /api/taste`
6. TanStack Query's `['tasteProfile']` key is invalidated → All Watches re-ranks immediately
7. Account details now link out to Trend instead of embedding the full Watch DNA form
8. Anonymous visitors see a guest CTA on Trend and can still sign in from the homepage spotlight

### Anonymous browsing flow

1. Anonymous visitor browses watches, brands, or collections
2. `behaviorTracker.ts` writes events into localStorage under `tourbillon-behavior` and keeps a persistent `tourbillon-anon-id`
3. Existing-account sign-in or session restore flushes that local buffer to `POST /api/behavior/events`
4. `POST /api/behavior/merge` reassigns those anonymous `UserBrowsingEvents` rows to that same authenticated user
5. Newly created accounts do not inherit pre-signup anonymous browsing; `AuthContext` resets the anonymous browser state instead
6. Logout also resets the anonymous browser state so later signed-out browsing does not bleed into another account
7. No taste profile row is written during anonymous browsing itself
8. `UserTasteProfiles` updates only when manual save runs or when `/api/taste/generate` runs for the signed-in user

### Test coverage and limits

Automated tests currently verify the deterministic parts of Watch DNA:

- event deduplication and anonymous-to-user merge behavior
- the `>= 3` event threshold before AI generation runs
- cooldown and refresh rules
- the payload shape sent to `/generate-dna-from-behavior`
- mapping the AI response into persisted behavior fields

Automated tests do not guarantee the semantic quality of the AI summary itself.

- They do not prove the wording is the best wording.
- They do not prove the inferred taste is directionally right for every real browsing pattern.
- They do not score whether the model over-indexed on a short burst of browsing.

That part still needs prompt evaluation and manual QA with realistic browsing scenarios.

There is now a dedicated AI-service evaluation harness for this boundary:

- `ai-service/tests/test_taste_behavior_eval.py` contains fixed browsing scenarios and acceptance rules
- the default contract test is deterministic and runs with a mocked LLM response
- the live evaluation class is opt-in and runs against the configured model only when `RUN_LIVE_TASTE_EVAL=1`

Example command from `ai-service/`:

```bash
venv/Scripts/python.exe -m unittest tests.test_taste_behavior_eval
```

Live model evaluation:

```bash
$env:RUN_LIVE_TASTE_EVAL="1"
venv/Scripts/python.exe -m unittest tests.test_taste_behavior_eval
```

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

Sort order: deterministic base catalogue order first, then a capped personalized re-rank inside the opening window. Brand caps keep the first rows visually diverse even when recent behavior leans heavily toward one maison.

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
| Summary | text? | Latest behavior-analysis summary |
| BehaviorPreferredBrandIds | text | JSON int[] default `[]` |
| BehaviorPreferredMaterials | text | JSON string[] default `[]` |
| BehaviorPreferredDialColors | text | JSON string[] default `[]` |
| BehaviorPriceMin | numeric? | |
| BehaviorPriceMax | numeric? | |
| BehaviorPreferredCaseSize | text? | `"small"` / `"medium"` / `"large"` / null |
| BehaviorAnalyzedAt | timestamptz? | Cooldown + freshness marker for auto generation |
| UpdatedAt | timestamptz | |

Migrations: `20260322010000_AddUserTasteProfile.cs`, `20260409051736_AddBehaviorTasteAnalysisFields.cs`

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
| `frontend/app/trend/TrendWatchDnaStudio.tsx` | Auto analysis surface + manual note editor |
| `frontend/app/watches/AllWatchesSection.tsx` | `scoreTasteMatch()` + capped trend-led sort |
| `frontend/app/components/TasteCTA.tsx` | Anonymous visitor CTA |
| `backend.Tests/Services/TasteProfileServiceTests.cs` | Pure scoring + cooldown unit tests |
| `backend.Tests/Services/TasteProfileGenerationTests.cs` | Generation threshold, cooldown, payload, and persistence contract tests |
| `backend.Tests/Services/BehaviorServiceTests.cs` | Event deduplication and anonymous merge tests |

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

**Frontend proxy note:** Even when general frontend API traffic uses `NEXT_PUBLIC_API_URL=/api/backend`, Google OAuth should still open the ASP.NET backend auth URL directly. This keeps the external-auth challenge, correlation cookie, `/signin-google` callback, and `/api/authentication/google-callback` controller on the same host with less proxy-specific failure risk.

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

