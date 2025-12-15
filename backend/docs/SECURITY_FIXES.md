# Tourbillon Security Fixes & Learning Guide

This document explains the critical security vulnerabilities found and how we fixed them. Each section is a security lesson for understanding defensive programming.

---

## Fix #1: Remove Exposed API Credentials

**Vulnerability:** Cloudinary API keys were hardcoded in `appsettings.json` and `.env.local`

**Why Dangerous:**
- Git stores them forever, even after deletion
- Anyone with repo access can steal credentials
- Attackers can upload malware to your CDN
- You pay for their unauthorized usage

**Problem Code:**
```json
// ❌ NEVER DO THIS
"Cloudinary": {
  "ApiKey": "294795863329897",
  "ApiSecret": "rsL_XGNc4VPVlHqCIOHHQlk9BHo"
}
```

**Solution:**
1. Remove credentials from `appsettings.json` (replace with empty strings)
2. Remove credentials from `.env.local` (replace with empty strings)
3. Store secrets in User Secrets (development):
```bash
cd backend
dotnet user-secrets set "Cloudinary:CloudName" "your-value"
dotnet user-secrets set "Cloudinary:ApiKey" "your-value"
dotnet user-secrets set "Cloudinary:ApiSecret" "your-value"
```
4. Store secrets in environment variables (production/deployment)

**How It Works:**
ASP.NET Core's `IConfiguration` searches in order:
- appsettings.json (empty, safe to commit)
- User Secrets (git-ignored, dev only)
- Environment Variables (production)

No code changes needed - `CloudinaryService` already uses `IConfiguration`.

**Status:** ✓ FIXED - Credentials removed from source code

---

## Fix #2: Add Role-Based Access Control (Admin Endpoints)

**Vulnerability:** `AdminController` had NO authorization checks - anyone could delete database or trigger scraping

**Why Dangerous:**
```csharp
// ❌ VULNERABLE - No [Authorize] attribute
public class AdminController : ControllerBase
{
    [HttpDelete("clear-watches")]
    public async Task<IActionResult> ClearWatches()
    {
        // Anyone on the internet can call this!
    }
}
```
Attackers could:
- Delete entire watch database
- Trigger expensive scraping operations
- Crash your server
- Cost you money

**Solution:**
1. Create Admin role in database
2. Add `[Authorize(Roles = "Admin")]` to AdminController
3. Create `RoleManagementService` to manage user roles
4. Seed initial Admin role in `DbInitializer`
5. Add `[Authorize]` to other protected controllers

**Fixed Code:**
```csharp
// ✓ FIXED - Admin role required
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    [HttpDelete("clear-watches")]
    public async Task<IActionResult> ClearWatches() { }
}
```

**Test:**
- Anonymous user tries to access `/api/admin/*` → 401 Unauthorized
- Regular user tries to access → 403 Forbidden
- Admin user accesses → 200 Success

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #3: Fix SQL Injection in Database Creation

**Vulnerability:** Database name wasn't validated - string interpolation in SQL query

**Problem Code (Program.cs lines 149-162):**
```csharp
// ❌ VULNERABLE - SQL Injection possible
var checkDbQuery = $"SELECT 1 FROM pg_database WHERE datname = '{databaseName}'";
```

**Attack Scenario:**
```
If attacker controls databaseName:
databaseName = "'; DROP DATABASE production; --"
Results in:
SELECT 1 FROM pg_database WHERE datname = ''; DROP DATABASE production; --'
Database deleted!
```

**Solution - Use Parameterized Queries:**
```csharp
// ✓ FIXED - Parameterized query
var checkDbQuery = "SELECT 1 FROM pg_database WHERE datname = @databaseName";
using var checkCmd = new NpgsqlCommand(checkDbQuery, adminConnection);
checkCmd.Parameters.AddWithValue("@databaseName", databaseName);
```

**Why This Works:**
Parameterized queries treat user input as DATA, not CODE. Even if input contains SQL keywords, they're treated as literal text.

**Key Lesson:**
Never use string interpolation (`$"..."`) for SQL. Always use parameterized queries with `@parameters`.

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #4: Use Cryptographically Secure Random for Verification Codes

**Vulnerability:** Using `new Random()` for password reset codes - predictable

**Problem Code (PasswordResetService.cs):**
```csharp
// ❌ VULNERABLE - Not cryptographically secure
private static string GenerateVerificationCode()
{
    var random = new Random();
    return random.Next(100000, 999999).ToString();
}
```

**Why Dangerous:**
- `Random` is deterministic (predictable if attacker knows seed time)
- Only 1 million possible codes (6 digits)
- Brute force: attacker can guess in seconds
- Used for password reset (critical operation)

**Solution:**
```csharp
// ✓ FIXED - Cryptographically secure
using System.Security.Cryptography;

private static string GenerateVerificationCode()
{
    return RandomNumberGenerator.GetInt32(100000, 999999).ToString();
}
```

**Why It Works:**
`RandomNumberGenerator` uses OS entropy (Windows CSPRNG, Linux /dev/urandom), impossible to predict.

**Key Lesson:**
For security-critical operations (tokens, codes, keys), use `RandomNumberGenerator`. For non-security purposes, `Random` is fine.

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #5: Implement Account Lockout & Login Rate Limiting

**Vulnerability:** No protection against brute force attacks on login

**Problem:**
- Attackers try unlimited password combinations
- Credential stuffing attacks (testing stolen passwords)
- No rate limiting on login endpoint

**Solution - Account Lockout:**
```csharp
// Enable lockout in Program.cs
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
});

// Enable in login
var result = await _signInManager.PasswordSignInAsync(
    email, password,
    isPersistent: false,
    lockoutOnFailure: true  // ✓ CHANGED FROM false
);
```

**Solution - Rate Limiting:**
1. Install NuGet: `AspNetCoreRateLimit`
2. Configure in Program.cs:
```csharp
services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule { Endpoint = "POST:/api/authentication/login", Period = "1m", Limit = 10 }
    };
});
```

**Result:**
- 5 failed attempts → 15 min lockout per user
- 10 login attempts per IP per minute
- Brute force becomes impossible

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #6: Add Security Headers Middleware

**Vulnerability:** Missing security headers - vulnerable to clickjacking, XSS, MIME sniffing

**Solution - Create Middleware:**
```csharp
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Prevent clickjacking (website can't be embedded in iframe)
        context.Response.Headers.Add("X-Frame-Options", "DENY");

        // Prevent MIME sniffing attacks
        context.Response.Headers.Add("X-Content-Type-Options", "nosniff");

        // XSS protection
        context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");

        // Force HTTPS (HSTS)
        context.Response.Headers.Add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

        // Content Security Policy (whitelist trusted sources)
        context.Response.Headers.Add("Content-Security-Policy",
            "default-src 'self'; img-src 'self' https://res.cloudinary.com;");

        await _next(context);
    }
}
```

**Register in Program.cs:**
```csharp
app.UseMiddleware<SecurityHeadersMiddleware>();
```

**Attacks Prevented:**
- X-Frame-Options: Prevents framing/clickjacking
- X-Content-Type-Options: Prevents browser MIME sniffing
- CSP: Blocks inline scripts (XSS prevention)
- HSTS: Forces HTTPS (SSL stripping prevention)

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #7: Add Authorization to Protected Controllers

**Vulnerability:** ProfileController and AccountController missing `[Authorize]` attribute

**Problem:**
- Unauthenticated users could access profile endpoints
- Horizontal privilege escalation: modify other users' profiles

**Solution:**
```csharp
// ✓ FIXED - Add [Authorize] to entire controller
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    [HttpPut("update")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        // Verify user is updating their own profile
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser.Id != dto.UserId)
            return Forbid("Can only update your own profile");

        // ... rest of code
    }
}
```

**Public vs Protected:**
```csharp
// Public endpoints (no [Authorize] needed)
GET /api/watch          // Browse watches
GET /api/brand          // Browse brands

// Protected endpoints (require authentication)
PUT /api/profile/update // Update profile
DELETE /api/account     // Delete account
```

**Key Lesson:**
Every controller/action handling user data needs authorization checks. Default to DENY, explicitly ALLOW.

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #8: Strengthen Password Policy

**Vulnerability:** Weak password requirements (8 chars, uppercase+digit only)

**Problem:**
- Password "PASSWORD1" would be accepted
- Only ~47 bits entropy (easily brute forced)
- Doesn't meet industry standards

**Solution (Program.cs):**
```csharp
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;  // ✓ ADDED
    options.Password.RequireLowercase = true;        // ✓ ADDED
    options.Password.RequiredLength = 12;            // ✓ CHANGED FROM 8
    options.Password.RequiredUniqueChars = 4;        // ✓ ADDED
});
```

**New Requirements:**
```
- Minimum 12 characters (NIST 2024 standard)
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (!@#$%^&*)
- At least 4 different characters (prevent "aaaa!!!!")
```

**Entropy Comparison:**
- Old: 8 chars, limited charset = ~47 bits (2 hours to brute force)
- New: 12 chars, full charset = ~78 bits (1000 years to brute force)

**User Experience:**
- Registration requires strong password
- Error messages show requirements
- Copy/paste encouraged for complex passwords

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #9: Add Email Verification Requirement

**Vulnerability:** Users could register with fake/stolen email addresses

**Problem:**
```csharp
// ❌ VULNERABLE - Auto-signed in without verification
await _userManager.CreateAsync(user, password);
await _signInManager.SignInAsync(user, isPersistent: false);
```

**Dangers:**
- Account impersonation
- Spam account creation
- Can't recover accounts
- Can't verify user contact

**Solution:**
```csharp
// ✓ FIXED - Send verification email
var result = await _userManager.CreateAsync(user, password);
if (result.Succeeded)
{
    // Generate secure token
    var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);

    // Send email with confirmation link
    var confirmUrl = $"https://yourdomain.com/confirm-email?token={token}&userId={user.Id}";
    await _emailService.SendAsync(user.Email, "Confirm Email", confirmUrl);

    return Ok("Check your email to confirm account");
    // Don't sign in until email confirmed
}
```

**Create Confirmation Endpoint:**
```csharp
[HttpPost("confirm-email")]
public async Task<IActionResult> ConfirmEmail(string userId, string token)
{
    var user = await _userManager.FindByIdAsync(userId);
    if (user == null) return BadRequest("Invalid user");

    var result = await _userManager.ConfirmEmailAsync(user, token);
    return result.Succeeded ? Ok("Email confirmed") : BadRequest("Failed");
}
```

**Prevent Login Until Verified:**
```csharp
var user = await _userManager.FindByEmailAsync(email);
if (!user.EmailConfirmed)
    return Unauthorized("Please verify your email first");
```

**Token Security:**
- Generated by ASP.NET Core Identity (cryptographically secure)
- Single-use (invalidated after confirmation)
- Time-limited (24 hour expiration)
- Validated server-side only

**Status:** ✓ TO BE IMPLEMENTED

---

## Fix #10: Remove Test Endpoint from Production

**Vulnerability:** Test email endpoint exposed in production code

**Problem:**
```csharp
// ❌ VULNERABLE - Available in production build
[HttpPost("test-email")]
public async Task<IActionResult> TestEmail([FromBody] TestEmailDto dto)
{
    // Anyone can call this to spam emails
}
```

**Dangers:**
- Email service spamming (costs money)
- Phishing attacks using your email
- Configuration information disclosure

**Solution - Debug-Only Compilation:**
```csharp
#if DEBUG
[HttpPost("test-email")]
public async Task<IActionResult> TestEmail([FromBody] TestEmailDto dto)
{
    // This only compiles in Debug builds
    // Completely removed from Release builds
}
#endif
```

**How It Works:**
- Debug build (development): Endpoint included
- Release build (production): Endpoint NOT compiled in
- No runtime checks needed, removed at compile time

**Test:**
```bash
# Debug build (development)
dotnet build -c Debug
# Endpoint works

# Release build (production)
dotnet build -c Release
# Endpoint doesn't exist (404)
```

**Key Lesson:**
Never leave debug/test code in production. Use preprocessor directives or remove entirely before deploying.

**Status:** ✓ TO BE IMPLEMENTED

---

## Security Fixes Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Exposed API Keys | CRITICAL | ✓ FIXED |
| 2 | Unprotected Admin Endpoints | CRITICAL | ⏳ TODO |
| 3 | SQL Injection | CRITICAL | ⏳ TODO |
| 4 | Weak Random Generation | CRITICAL | ⏳ TODO |
| 5 | No Brute Force Protection | HIGH | ⏳ TODO |
| 6 | Missing Security Headers | HIGH | ⏳ TODO |
| 7 | Missing Authorization | HIGH | ⏳ TODO |
| 8 | Weak Password Policy | MEDIUM | ⏳ TODO |
| 9 | No Email Verification | MEDIUM | ⏳ TODO |
| 10 | Test Endpoint in Prod | MEDIUM | ⏳ TODO |

---

## Key Lessons for Future Development

### ✅ DO:
- Use environment variables for ALL secrets
- Use User Secrets in development
- Use Key Vault in production
- Always add `[Authorize]` to protected endpoints
- Always validate user input
- Use parameterized queries for SQL
- Use cryptographically secure random for security
- Add security headers to all responses
- Require strong passwords
- Verify email addresses

### ❌ DON'T:
- Don't hardcode credentials
- Don't commit secrets to git
- Don't use `System.Random` for security
- Don't forget authorization checks
- Don't use string interpolation in SQL
- Don't leave test endpoints in production
- Don't trust user input
- Don't use weak password policies

---

## Testing Security Fixes

After implementing each fix, test with:

**1. Browser DevTools:**
- Network tab → Response Headers
- Verify security headers present

**2. Postman/cURL:**
- Test with missing auth → Should get 401
- Test with wrong role → Should get 403
- Test with malicious input → Should validate

**3. Code Review:**
- Search for missing `[Authorize]` attributes
- Look for string interpolation in SQL
- Verify all endpoints have proper checks

**4. Security Scanner:**
```bash
# Scan for hardcoded secrets
dotnet add package SecretScanning

# Scan dependencies for vulnerabilities
dotnet add package Acr.Security.Vulnerability
```

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [ASP.NET Core Security](https://learn.microsoft.com/aspnet/core/security)
- [12 Factor App Config](https://12factor.net/config)
- [CWE-Top-25](https://cwe.mitre.org/top25/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

**Last Updated:** 2025-12-16
**Learning Level:** Security Fundamentals
**Difficulty:** Intermediate
