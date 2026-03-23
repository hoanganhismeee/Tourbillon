# Security Audit — Tourbillon

## Authentication Mechanism

**Cookie-based sessions — not JWT.**

ASP.NET Core Identity issues an HttpOnly session cookie on login. Configuration in `backend/Program.cs`:

```csharp
options.Cookie.HttpOnly = true;
options.Cookie.SameSite = SameSiteMode.Strict;
options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
options.SlidingExpiration = true;
```

- `HttpOnly`: JavaScript cannot read the cookie (XSS-resistant)
- `SameSite=Strict`: cookie not sent on cross-site requests (CSRF-resistant without tokens)
- 30-minute sliding expiration: resets on each authenticated request

---

## Fix Now

These are low-effort, worthwhile even in local dev.

### 1. Weak RNG for OTP and password reset codes

| File | Line |
|------|------|
| `backend/Services/MagicLoginService.cs` | 125 |
| `backend/Services/PasswordResetService.cs` | 66 |

Both use `new Random()` to generate OTP codes. `System.Random` is seeded by time and is predictable under rapid concurrent calls.

**Fix:** Replace with `System.Security.Cryptography.RandomNumberGenerator`.

```csharp
// Before
var rng = new Random();

// After — MagicLoginService (alphanumeric)
var bytes = RandomNumberGenerator.GetBytes(length);

// After — PasswordResetService (numeric)
int code = RandomNumberGenerator.GetInt32(100000, 1000000);
```

### 2. Seed admin email committed to appsettings.json

| File | Line |
|------|------|
| `backend/appsettings.json` | ~39 |

The email address that auto-receives Admin role on first registration is hardcoded in a committed config file. If the repo ever becomes public (or is cloned), the admin email is exposed.

**Fix:** Move to user-secrets:

```bash
dotnet user-secrets set "AdminSettings:SeedEmail" "your@email.com"
```

---

## Fix Before Production

These are intentional dev shortcuts. Address before any public deployment.

### 3. `[AllowAnonymous]` on admin scraping endpoints

| File | Lines |
|------|-------|
| `backend/Controllers/AdminController.cs` | 233, 353, 458, 1364 |

The controller carries `[Authorize(Roles = "Admin")]` at class level, but four methods override this with `[AllowAnonymous]`:
- `POST /api/admin/scrape-url`
- `POST /api/admin/scrape-listing`
- `POST /api/admin/add-watches`
- `POST /api/admin/editorial/seed`

**Before prod:** Remove all four `[AllowAnonymous]` attributes.

### 4. Hardcoded `http://localhost:3000` in Google OAuth callback

| File | Line |
|------|-------|
| `backend/Controllers/AuthenticationController.cs` | 259 |

```csharp
const string frontendBase = "http://localhost:3000";
```

**Before prod:** Read from `IConfiguration` or an env var (`FRONTEND_BASE_URL`).

### 5. Unprotected test-email endpoint

| File | Lines |
|------|-------|
| `backend/Controllers/AuthenticationController.cs` | 324–358 |

`POST /api/authentication/test-email` has no `[Authorize]` attribute. A comment in the code says "REMOVE IN PRODUCTION".

**Before prod:** Delete the endpoint.

### 6. No rate limiting on login; lockout disabled

| File | Line |
|------|-------|
| `backend/Controllers/AuthenticationController.cs` | 70 |

```csharp
var result = await _signInManager.PasswordSignInAsync(..., lockoutOnFailure: false);
```

No rate-limiting middleware on `POST /api/authentication/login`.

**Before prod:** Enable `lockoutOnFailure: true` and add rate limiting (e.g., `AspNetCoreRateLimit` or ASP.NET Core's built-in `RateLimiter` middleware).

### 7. Frontend scraper-proxy route has no server-side auth check

| File |
|------|
| `frontend/app/api/scraper-proxy/route.ts` |

The Next.js route handler proxies to the backend without verifying the caller is an admin. Currently mitigated by the frontend UI guard and backend auth, but not defense-in-depth.

**Before prod:** Add an explicit Next.js middleware check (e.g., read the session cookie and verify the Admin role before forwarding).

---

## Already Solid

These are correctly implemented and require no changes:

- **Password change security** — rate limited (5 attempts per 15 min), current password verified, separate `PasswordChangeService`
- **Magic login OTP** — 10-min TTL, one-time use, email-existence non-disclosure (always returns 200)
- **Password reset codes** — 30-second cooldown between requests, 10-min TTL, one-time use
- **Request sanitization** — `RequestSanitizationMiddleware` redacts password fields from all logs
- **CORS** — restricted to `ALLOWED_ORIGINS` env var; defaults to `localhost:3000`
- **Role-based access control** — `[Authorize(Roles = "Admin")]` gates scraping at controller level
- **Frontend token storage** — no JWT in localStorage/sessionStorage; auth state lives only in HttpOnly cookie
- **No XSS vectors** — no `dangerouslySetInnerHTML` or `eval()` in frontend
- **Cloudinary API secret** — not prefixed `NEXT_PUBLIC_`, kept server-side only
- **Input validation** — email, phone, password complexity validated client-side and enforced server-side
