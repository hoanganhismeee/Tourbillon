# educational

A plain-language reference for the infrastructure and operational patterns used (or planned) in Phase 7. Each section covers what the technology is, why it matters, how it works, and what it changes in Tourbillon specifically.

---

## 1. Durable Background Jobs

When your app needs to do work that shouldn't block the user's request — sending an email, generating embeddings, updating a cache — it runs that work "in the background." The simplest way is fire-and-forget: start the task and move on.

The problem with fire-and-forget is the "forget" part. If the task fails (SMTP server down, database timeout, out-of-memory), nobody knows. The failure is logged to console (maybe) and lost. There's no retry. No record that it happened. No way to find out why 200 appointment confirmation emails silently failed last week.

**Durable background jobs** treat background work as persistent records, not ephemeral threads. The job is written to a database before it executes. If it fails, the system retries with exponential backoff (wait 1s, then 2s, then 4s, then 8s...). If it keeps failing, it moves to a "failed" queue where you can inspect it, fix the issue, and manually retry. A dashboard shows what's running, what succeeded, what failed, and what's queued.

### How it works (Hangfire)

Hangfire is a .NET library for durable background processing. It stores jobs in your existing PostgreSQL database (no additional infrastructure needed). When you call `BackgroundJob.Enqueue(...)`, Hangfire serializes the method call + arguments to a database row. A background worker picks it up, executes it, and marks it complete. If it throws an exception, Hangfire waits and retries (default: 10 attempts over ~3 hours). You get a web dashboard at `/hangfire` showing all job activity.

### Job types

- **Fire-and-forget** — run once, right now, but with retry if it fails.
  `BackgroundJob.Enqueue(() => emailService.SendAsync(...))`
- **Delayed** — run once, but wait first.
  `BackgroundJob.Schedule(() => ..., TimeSpan.FromMinutes(30))`
- **Recurring** — run on a cron schedule.
  `RecurringJob.AddOrUpdate("cleanup", () => ..., Cron.Daily)`
- **Continuation** — run B after A finishes.
  `BackgroundJob.ContinueWith(jobAId, () => ...)`

### What changes in Tourbillon

Currently, 7+ services use `_ = Task.Run(async () => { ... })` for background work. Each becomes a Hangfire enqueue:

```csharp
// BEFORE — silent fire-and-forget
_ = Task.Run(async () => {
    using var scope = _serviceProvider.CreateScope();
    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
    await emailService.SendEmailAsync(to, subject, body);
});

// AFTER — durable, retryable, visible
BackgroundJob.Enqueue<IEmailService>(x => x.SendEmailAsync(to, subject, body));
```

Services that change:
- `AppointmentService` — 2 emails after booking
- `ContactInquiryService` — 2 emails after inquiry
- `RegisterInterestService` — 2 emails after registration
- `WatchCacheService` — embedding generation after scrape
- `WatchFinderService` — embedding + cache updates (2 locations)
- `WatchEditorialService` — editorial chunk embedding

Dependencies: `Hangfire.Core`, `Hangfire.AspNetCore`, `Hangfire.PostgreSql` NuGet packages.

### Why it matters

Production systems need resilience, not just functionality. Fire-and-forget is fine for a prototype; durable jobs are what production services use. Interview question: "What happens if your background task fails?" — with Hangfire, you have a real answer: automatic retry with backoff, persistent job records, monitoring dashboard, and manual re-trigger for permanently failed jobs.

---

## 2. Redis

Redis is an in-memory data store — a dictionary (`key -> value`) that lives outside your application. Unlike your app's memory (which dies on restart), Redis runs as a separate process and persists data independently.

### The problem it solves

Tourbillon currently stores several things in the backend's own memory:
- Rate limit counters (5 chat messages/day per user)
- Magic login OTP codes (10-minute expiry)
- Password reset codes
- Chat conversation history (last 10 turns)

Restart the backend and all of it vanishes. A user mid-magic-login gets a broken flow. Rate limits reset — everyone gets free quota. Chat context disappears mid-conversation.

### How it works

Redis stores key-value pairs with optional TTL (time-to-live). You set a key: `SET chat_rl_user42 3 EX 86400` (user42 has used 3 of their daily messages, expires in 86400 seconds). You increment atomically: `INCR chat_rl_user42`. When the TTL expires, Redis deletes the key automatically — no cleanup code needed.

Data structures Redis supports:
- **Strings** — simple values, counters, flags
- **Hashes** — nested dictionaries (`HSET chat:session123 history "[...]"`)
- **Lists** — ordered sequences (job queues, activity logs)
- **Sets** — unique collections (online users, active sessions)
- **Sorted sets** — ranked data (leaderboards, priority queues)

### Three patterns Redis replaces in Tourbillon

**Pattern 1 — Distributed rate limiting:**

Current: `IMemoryCache` with expiring entries in `PasswordChangeRateLimitService` and `ChatService`.
Problem: restart = reset, not shared across instances.
Redis: `INCR chat_rl_{userId}` (atomic counter) + `EXPIRE chat_rl_{userId} 86400` (auto-reset at midnight). Survives restarts, shared across any number of app instances.

**Pattern 2 — Session storage:**

Current: `ConcurrentDictionary<string, ChatSession>` singleton registered in `Program.cs`.
Problem: restart = all sessions gone, no TTL = sessions accumulate forever (memory leak).
Redis: `HSET chat:session:{id} history "[serialized messages]"` + `EXPIRE chat:session:{id} 3600` (auto-cleanup after 1 hour idle). Survives restarts, self-cleaning.

**Pattern 3 — Auth code storage:**

Current: `IMemoryCache` with 10-minute absolute expiry in `MagicLoginService` and `PasswordResetService`.
Problem: restart = user's OTP vanishes mid-login-flow.
Redis: `SET magic:{email} {code} EX 600` (10-minute TTL). Survives restarts, exact same behavior but persistent.

### Infrastructure change

Add a `redis` service to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

Backend: replace `IMemoryCache` with `IDistributedCache` (built into ASP.NET, Redis-backed). NuGet: `Microsoft.Extensions.Caching.StackExchangeRedis`.

### Why it matters

Redis is used in nearly every production web application. Interview questions about caching, rate limiting, and session management almost always lead to Redis. Knowing it is expected for mid-level+ backend roles.

---

## 3. CI/CD Pipeline

CI/CD = Continuous Integration / Continuous Deployment. Every time you push code, an automated system builds it, runs tests, and (optionally) deploys it.

Without CI/CD, quality depends on remembering to run `dotnet build` and `dotnet test` before pushing. One forgotten check = broken main branch. With CI/CD, the system catches it automatically.

### How it works (GitHub Actions)

GitHub Actions runs workflows (YAML files) in response to events (push, pull request, schedule). Each workflow has jobs, and each job runs on a virtual machine with your code checked out.

### Tourbillon CI workflow

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0' }
      - run: dotnet restore backend/backend.csproj
      - run: dotnet build backend/backend.csproj --no-restore
      - run: dotnet test backend.Tests/backend.Tests.csproj --no-restore

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npx tsc --noEmit
```

### Quality gates

Rules that must pass before code can merge:
- Build succeeds (no compilation errors)
- All tests pass
- Type-check passes (TypeScript)
- Optional: code coverage doesn't drop below X%
- Optional: Lighthouse score stays above Y

If any step fails, the workflow fails. GitHub shows a red X on the PR. Branch protection rules can block merging until CI passes.

### Why it matters

CI/CD is not a differentiator — it's a baseline expectation. Not having it is the thing that stands out (negatively). Every professional team uses some form of CI.

---

## 4. Observability

Observability = the ability to understand what your system is doing by looking at its outputs. Three pillars: **logs** (what happened), **metrics** (how much/how fast), **traces** (how a request flowed through the system).

### 4a. Structured Logging (Serilog)

The app currently logs to console with unstructured text. In production, console output disappears. You need logs that persist, are searchable, and are structured (machine-readable).

Regular logging:
```
info: ChatService[0]
      Processing chat message for user 42, session abc-123
```

Structured logging (same code, Serilog output):
```json
{
  "Timestamp": "2026-03-30T10:15:00Z",
  "Level": "Information",
  "MessageTemplate": "Processing chat message for user {UserId}, session {SessionId}",
  "Properties": {
    "UserId": 42,
    "SessionId": "abc-123",
    "RequestId": "req-456",
    "SourceContext": "ChatService"
  }
}
```

The difference: structured logs are queryable. You can filter "show me all errors for user 42 in the last hour" or "all ChatService logs where Level = Error." Plain text requires grep and regex.

**Sinks** = where logs go. Multiple sinks simultaneously:
- **Console** — human-readable for local dev
- **File** — rolling JSON log files, auto-rotated by date/size
- **Seq** — free self-hosted log viewer with search/filter UI (optional Docker container)

### 4b. Health Checks

ASP.NET has built-in health check endpoints. Register checks for each dependency:

```csharp
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "postgresql")
    .AddRedis(redisConnection, name: "redis")
    .AddUrlGroup(new Uri("http://ai-service:5000/health"), name: "ai-service");

app.MapHealthChecks("/health/ready");    // all deps healthy?
app.MapHealthChecks("/health/live");     // app running?
```

Docker, Kubernetes, and load balancers use these endpoints to decide if a container is healthy. If `/health/ready` returns 503 (unhealthy), traffic stops routing to that instance.

Currently the Docker healthcheck hits `curl /api/brand` — this works but doesn't verify Redis, AI service, or database connectivity. A proper health endpoint checks all dependencies.

### 4c. Metrics

Operational numbers tracked over time:
- Search queries per tier (Tier 2 / Tier 3 / Tier 4 / cache hit)
- Query cache hit rate (percentage)
- AI service response time (p50, p95, p99)
- Email delivery success rate
- Hangfire queue depth (jobs waiting)

Start simple: counters in a `Metrics` singleton, logged periodically via Serilog. Graduate to OpenTelemetry + Prometheus + Grafana for dashboards if needed.

### Why it matters

"How do you debug a production issue?" is a common interview question. The answer should involve structured logs, health checks, and metrics — not "I SSH into the server and tail the console output."

---

## 5. Advisor CRM + Inquiry Pipeline

CRM = Customer Relationship Management. The system businesses use to track customer interactions across their lifecycle: first contact, follow-up, negotiation, sale, post-sale support.

### The problem it solves

Tourbillon has three ways customers reach out:
- Contact Advisor (located in contact page, for any issue)
- Register Interest (express interest in a watch)
- Book Appointment (schedule an in-person visit)

Each submission is currently a one-shot insert into the database. An email goes out, and that's it. No way to track: "Did someone follow up? What was the outcome? How many open inquiries do we have?"

### What a CRM pipeline adds

**Status tracking:**
```
New -> Contacted -> In Progress -> Closed (Won) / Closed (Lost) / Closed (No Response)
```

Each inquiry gets a status. At a glance: 12 new inquiries, 5 being worked, 3 awaiting response.

**Advisor notes:** Free-text notes per inquiry. "Client comparing the 5711 and Overseas. Budget ~$80k. Prefers stainless steel. Following up Thursday."

**Follow-up reminders:** Set a date; Hangfire sends the advisor a reminder email.

**Unified view:** One admin page showing all three inquiry types in a single timeline, sorted by date, filterable by status.

### Implementation in Tourbillon

- Add `Status` (enum), `AssignedAdvisor`, `Notes` (list), `FollowUpDate` to existing inquiry tables
- New `CrmController` with endpoints for listing, status update, note add, follow-up set
- Admin frontend page at `/admin/crm` with table/kanban view
- Hangfire recurring job to check follow-up dates and send reminders

### Why it matters

Shows domain understanding, not just technical ability. "I built a CRM pipeline for luxury watch advisors" tells an interviewer you can model business processes, not just CRUD endpoints. Luxury watch sales are relationship-driven — this is the core business tool for this type of retailer.

---

## 6. Search and Recommendation Analytics

Analytics = measuring how users interact with your features so you can understand what works and what doesn't.

### The problem it solves

When a user searches "dress watch under 20k", Tourbillon serves the result but doesn't record:
- What they searched for
- Which tier handled it (cache hit? Tier 2? Tier 3 with LLM rerank?)
- How many results were returned
- Which result they clicked on
- Whether 50 different users searched the same thing

Without analytics: "Is the semantic cache actually helping? What's the hit rate? Are users finding what they want?"

### What to track

Search events:
```json
{
  "type": "search",
  "query": "dress watch under 20k",
  "tier": "cache_hit",
  "resultCount": 12,
  "timestamp": "2026-03-30T10:15:00Z",
  "userId": 42
}
```

Click events:
```json
{
  "type": "search_click",
  "query": "dress watch under 20k",
  "watchId": 156,
  "position": 3,
  "timestamp": "2026-03-30T10:15:05Z"
}
```

Dashboard metrics:
- Cache hit rate over time (line chart)
- Top 20 search queries (table)
- Tier distribution (pie chart: Tier 2 vs 3 vs 4 vs cache)
- Most viewed / favourited / compared watches
- Chat query type distribution (PRODUCT vs BRAND vs GENERAL)

### Implementation

- Backend: `AnalyticsEvent` model + table (type, JSON data, timestamp, userId)
- Backend: `AnalyticsService` for event recording + aggregation queries
- Backend: `AnalyticsController` with admin-only endpoints
- Frontend: event tracking in Smart Search + Chat widget (async via Hangfire)
- Frontend: admin dashboard at `/admin/analytics` with chart library (Recharts)

### Why it matters

"I measured that 72% of search queries hit the semantic cache" is far more impressive than "I built a cache." Demonstrates data-driven engineering — you think about whether features work, not just whether they exist.

---

## 7. Kubernetes

Kubernetes (K8s) is a container orchestration platform. It manages running, scaling, and connecting containers across a cluster of machines.

With Docker Compose, you define containers and run them on one machine. With Kubernetes, you define containers and K8s decides where to run them, how many copies, and what happens when one fails.

### Core concepts

**Pod** — the smallest deployable unit. Usually one container per pod. Pods are ephemeral — K8s can kill and recreate them at any time.

**Deployment** — declares "I want 2 replicas of the backend pod running at all times." If one dies, K8s starts a replacement. On new image push, K8s does a rolling update (starts new pods, waits until healthy, kills old pods — zero downtime).

**Service** — a stable network address routing traffic to pods. Pods come and go; the Service address stays the same. `backend-service:8080` always reaches a healthy backend pod.

**Ingress** — routes external HTTP traffic to the right Service. Like a reverse proxy: `api.tourbillon.com` -> backend-service, `tourbillon.com` -> frontend-service.

**ConfigMap / Secret** — configuration and sensitive values injected into pods as environment variables. Secrets are base64-encoded (not encrypted by default — use sealed-secrets or external managers for real security).

**HPA (Horizontal Pod Autoscaler)** — scales replicas based on CPU/memory. "If average CPU > 70%, add another backend pod." Scales down when traffic drops.

### Tourbillon K8s architecture

```
                        Ingress (TLS termination)
                        /                    \
               frontend-svc              backend-svc
               (Next.js)                (.NET + Hangfire)
                                             |
                                    ai-service-svc
                                    (Flask + Ollama)
                                             |
                                    --------+--------
                                    |               |
                                postgres-svc    redis-svc
```

Files to create:
- `k8s/backend-deployment.yaml` — Deployment + Service
- `k8s/ai-service-deployment.yaml` — Deployment + Service
- `k8s/postgres-statefulset.yaml` — StatefulSet (persistent storage)
- `k8s/redis-deployment.yaml` — Deployment + Service
- `k8s/ingress.yaml` — Ingress with TLS
- `k8s/configmap.yaml` — non-secret configuration
- `k8s/secrets.yaml` — API keys, DB passwords

### Honest assessment

For Tourbillon specifically, K8s is over-engineering. Docker Compose on one EC2 handles the expected traffic. K8s makes sense when you need: auto-scaling, zero-downtime rolling deployments, multi-node clusters, or standardized deployment across environments. The value here is resume/learning — not operational necessity. Do this last.

---

## 8. Storage Abstraction + S3 + CloudFront

Images currently live on Cloudinary (third-party CDN). S3 (Simple Storage Service) is AWS's object storage — an infinite hard drive in the cloud. CloudFront is AWS's CDN — caches S3 files at edge locations worldwide for fast downloads regardless of geography.

### Storage abstraction

An interface that hides which storage provider you're using. Application code says `await storage.UploadAsync(file)` — it doesn't know or care if that goes to Cloudinary, S3, or a local folder. Swap providers by changing configuration, not code.

Cloudinary is already behind `ICloudinaryService` with clean methods. The abstraction is partly done.

### What this adds

**Step 1 — Generic interface:**
```csharp
public interface IStorageService
{
    Task<string> UploadAsync(Stream file, string path);
    Task DeleteAsync(string path);
    string GetPublicUrl(string path);
}

// Existing Cloudinary becomes one implementation
public class CloudinaryStorageService : IStorageService { ... }

// New S3 implementation
public class S3StorageService : IStorageService { ... }
```

**Step 2 — S3 bucket:**
Create bucket, configure public-read policy for images, upload via AWS SDK (`AWSSDK.S3` NuGet).

**Step 3 — CloudFront CDN:**
Distribution pointing to S3 bucket. Custom domain (`images.tourbillon.com`). HTTPS via ACM (free certificate). Cache policy: 30 days for images (watch images rarely change).

### How CDN works

User in Tokyo requests `images.tourbillon.com/PP5711.png`. CloudFront checks Tokyo edge server. Cached? Instant response. Not cached? Fetch from S3 origin, cache at Tokyo edge, return. Next Tokyo user gets the cached version. Same image replicated across 50+ edge locations.

### Cost comparison

| Provider | Cost |
|---|---|
| Cloudinary free tier | 25 credits/month (adequate for portfolio) |
| S3 | ~$0.023/GB/month (~$0.12/month for 5GB) |
| CloudFront | First 1TB/month free |

### Why it matters

S3 + CloudFront is the standard production image hosting pattern. Shows cloud infrastructure skills, CDN understanding, and vendor-agnostic design.

---

## Implementation Order

| # | Milestone | Effort | Dependencies |
|---|---|---|---|
| 1 | CI/CD Pipeline | 1-2 days | None — catches issues in everything after |
| 2 | Durable Background Jobs (Hangfire) | 2-3 days | None |
| 3 | Redis | 2-3 days | None |
| 4 | Observability (Serilog + health checks) | 2-3 days | None |
| 5 | Deploy to production | 1-2 days | Steps 1-4 ideally done first |
| 6 | Advisor CRM | 3-4 days | Hangfire (for follow-up reminders) |
| 7 | Analytics Dashboard | 3-4 days | Hangfire (for async event recording) |
| 8 | S3 + CloudFront | 2-3 days | Deployment (need AWS account) |
| 9 | Kubernetes | 3-5 days | All above (converts Docker setup) |
