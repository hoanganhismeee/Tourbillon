using backend.Database;
using backend.Jobs;
using backend.Models;
using backend.Services;
using backend.Middleware;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using System.IO;
using Hangfire;
using Hangfire.Redis.StackExchange;
using Npgsql;
using Pgvector.EntityFrameworkCore;
using StackExchange.Redis;
using backend.Infrastructure;
using Serilog;
using Serilog.Events;

// Stage 1 bootstrap logger — captures startup errors before appsettings.json is loaded.
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{

var builder = WebApplication.CreateBuilder(args);

// Stage 2: read full Serilog config from appsettings.json + environment overrides.
builder.Host.UseSerilog((ctx, services, config) =>
    config.ReadFrom.Configuration(ctx.Configuration)
          .ReadFrom.Services(services)
          .Enrich.FromLogContext());

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add memory cache (retained for framework-level caching)
builder.Services.AddMemoryCache();

// Add DbContext (PostgreSQL) with pgvector support.
// Connections are tuned so Neon's serverless compute can scale to zero: idle
// pooled connections are pruned within seconds (default 300s would hold the
// compute awake well past Neon's ~5min autosuspend window) and MinPoolSize=0
// means nothing is kept open when traffic stops. MaxPoolSize is pinned on the
// EF data source so we never exceed Neon's hard connection cap.
var pgConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
var basePgBuilder = new NpgsqlConnectionStringBuilder(pgConnectionString)
{
    MinPoolSize = 0,
    ConnectionIdleLifetime = 15,
    ConnectionPruningInterval = 5,
};
var efConnectionString = new NpgsqlConnectionStringBuilder(basePgBuilder.ConnectionString)
{
    MaxPoolSize = 20,
}.ToString();
var pgDataSourceBuilder = new NpgsqlDataSourceBuilder(efConnectionString);
pgDataSourceBuilder.UseVector();
var pgDataSource = pgDataSourceBuilder.Build();
builder.Services.AddDbContext<TourbillonContext>(options =>
    options.UseNpgsql(pgDataSource, npgsqlOptions => npgsqlOptions.UseVector()));

// Register Redis for distributed state (rate limiting, auth codes, chat sessions).
// Built before Hangfire so job storage can share this single multiplexer rather
// than opening a second connection to the same server.
var redisConnectionString = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
var redisMultiplexer = ConnectionMultiplexer.Connect(redisConnectionString);
builder.Services.AddSingleton<IConnectionMultiplexer>(redisMultiplexer);
builder.Services.AddSingleton<IRedisService, RedisService>();

// Register Hangfire with Redis storage for durable background jobs. Postgres storage
// polled the database on a fixed cadence — its CountersAggregator alone runs every 5
// minutes, exactly Neon's autosuspend window, so the serverless compute could never
// suspend and billed ~24/7. Redis keeps that traffic off Neon entirely, and its
// blocking fetch dispatches queued jobs in seconds instead of after a poll interval.
// The server intervals below are sized against Upstash's free command budget.
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseRedisStorage(
        redisMultiplexer,
        new RedisStorageOptions
        {
            // 3-minute blocking fetch; returns the instant a job is pushed.
            FetchTimeout = TimeSpan.FromMinutes(3),
            ExpiryCheckInterval = TimeSpan.FromHours(6),
            InvisibilityTimeout = TimeSpan.FromMinutes(30),
        }));
builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = 2;
    // Drives cron and delayed jobs; the daily and 6-hourly schedules tolerate this.
    options.SchedulePollingInterval = TimeSpan.FromMinutes(5);
    options.HeartbeatInterval = TimeSpan.FromMinutes(5);
    // ServerTimeout must comfortably exceed the heartbeat interval so this single
    // server is never reaped between heartbeats.
    options.ServerCheckInterval = TimeSpan.FromMinutes(15);
    options.ServerTimeout = TimeSpan.FromMinutes(30);
});

// Register health checks — postgres + redis (Unhealthy on failure), ai-service (Degraded on failure)
builder.Services.AddTransient<AiServiceHealthCheck>();
builder.Services.AddHealthChecks()
    .AddNpgSql(efConnectionString, name: "postgres",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
        tags: ["ready"])
    .AddRedis(redisConnectionString, name: "redis",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
        tags: ["ready"])
    .AddCheck<AiServiceHealthCheck>("ai-service",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
        tags: ["ready"]);

// Adds and configures ASP.NET Core Identity for user management and authentication.
builder.Services.AddIdentity<User, IdentityRole<int>>(options =>
{
    // Sets the password complexity requirements for user accounts.
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = false;
})
.AddEntityFrameworkStores<TourbillonContext>() // Links Identity to the Entity Framework data store.
.AddRoleManager<RoleManager<IdentityRole<int>>>() // Enable role management
.AddDefaultTokenProviders(); // Required for external login token validation

// Add Google OAuth only when credentials are available (user-secrets in dev, env vars in prod).
// Skipping when absent prevents the auth middleware from crashing on every request.
var googleClientId     = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
if (!string.IsNullOrEmpty(googleClientId) && !string.IsNullOrEmpty(googleClientSecret))
{
    builder.Services.AddAuthentication()
        .AddGoogle(options =>
        {
            options.ClientId     = googleClientId;
            options.ClientSecret = googleClientSecret;
            // Default callback path is /signin-google; handled automatically by the middleware
        });
}

// Configure authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdminRole", policy =>
        policy.RequireRole("Admin"));
});

// Register secure password change service
builder.Services.AddScoped<IPasswordChangeService, PasswordChangeService>();
builder.Services.AddScoped<IPasswordSetupService, PasswordSetupService>();

// Register rate limiting service
builder.Services.AddScoped<IPasswordChangeRateLimitService, PasswordChangeRateLimitService>();
builder.Services.AddScoped<IAiUsageQuotaService, AiUsageQuotaService>();

// Register SOLID refactored services
builder.Services.AddScoped<IUserRegistrationService, UserRegistrationService>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<IAccountDeletionService, AccountDeletionService>();

// Configure SMTP settings
builder.Services.Configure<backend.Services.SmtpOptions>(
    builder.Configuration.GetSection(backend.Services.SmtpOptions.SectionName));

// Register email and password reset services
builder.Services.AddScoped<backend.Services.IEmailService, backend.Services.EmailService>();
builder.Services.AddScoped<backend.Services.BackgroundEmailService>();
builder.Services.AddScoped<backend.Services.IPasswordResetService, backend.Services.PasswordResetService>();

// Register role management service for managing user roles
builder.Services.AddScoped<IRoleManagementService, RoleManagementService>();

// Register currency converter and showcase watch mapping as singletons (stateless, thread-safe)
builder.Services.AddSingleton<CurrencyConverter>();

// Register Cloudinary service for image uploads
builder.Services.AddSingleton<ICloudinaryService, CloudinaryService>();

// Always register both concrete storage implementations for admin jobs (migration uses both simultaneously)
builder.Services.AddSingleton<CloudinaryStorageService>();
builder.Services.AddSingleton<S3StorageService>();

// Register the active storage provider (Cloudinary or S3) based on configuration
var storageProvider = builder.Configuration["Storage:Provider"] ?? "Cloudinary";
if (storageProvider.Equals("S3", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IStorageService>(sp => sp.GetRequiredService<S3StorageService>());
else
    builder.Services.AddSingleton<IStorageService>(sp => sp.GetRequiredService<CloudinaryStorageService>());

// Register migration job as transient — Hangfire creates one instance per execution
builder.Services.AddTransient<MigrateToS3Job>();

// Register retention job — scheduled daily by Hangfire below.
builder.Services.AddTransient<BrowsingEventRetentionJob>();

// Register watch cache service for database operations
builder.Services.AddScoped<WatchCacheService>();

// Register brand-specific scraper service for official brand websites
builder.Services.AddScoped<BrandScraperService>();

// Register sitemap-driven scraper service (Selenium-driven, no per-brand XPath config needed)
builder.Services.AddScoped<SitemapScraperService>();

// Register AI Watch Finder services
builder.Services.AddHttpClient("ai-service", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["AiService:BaseUrl"] ?? "http://localhost:5000");
    // 120s covers qwen2.5:7b in local dev and Claude Haiku in production with headroom.
    // Seed-editorial uses a separate Hangfire job with its own cancellation token.
    c.Timeout = TimeSpan.FromSeconds(120);
});
builder.Services.AddSingleton<WatchFilterMapper>();
builder.Services.AddSingleton<CatalogueOrderingService>();
builder.Services.AddScoped<IDeterministicWatchSearchService, DeterministicWatchSearchService>();
builder.Services.AddScoped<IWatchFinderService, WatchFinderService>();
builder.Services.AddScoped<WatchFinderService>();
builder.Services.AddScoped<WatchEmbeddingService>();
// BM25F index lives for the process and rebuilds itself; fused retrieval is per request.
builder.Services.AddSingleton<ILexicalWatchSearch, LexicalWatchSearchService>();
builder.Services.AddScoped<HybridWatchRetrievalService>();
builder.Services.AddScoped<QueryCacheService>();
builder.Services.AddScoped<WatchEditorialService>();

// Register chat concierge services (sessions stored in Redis — no in-memory singleton needed)
builder.Services.AddScoped<IIntentClassifier, ChatIntentClassifier>();
builder.Services.AddScoped<IActionPlanner, ActionPlannerService>();
builder.Services.AddScoped<ChatService>();

// Register taste profile service for Watch DNA personalization
builder.Services.AddScoped<ITasteProfileService, TasteProfileService>();

// Register magic login (passwordless OTP) service
builder.Services.AddScoped<IMagicLoginService, MagicLoginService>();

// Register contact inquiry service (advisor inquiries + email notifications)
builder.Services.AddScoped<IContactInquiryService, ContactInquiryService>();

// Register favourites service (user favourites and named collections)
builder.Services.AddScoped<IFavouritesService, FavouritesService>();

// Register appointment booking service
builder.Services.AddScoped<IAppointmentService, AppointmentService>();
builder.Services.AddScoped<IRegisterInterestService, RegisterInterestService>();

// Register behavior tracking service for Watch DNA behavioral profile generation
builder.Services.AddScoped<IBehaviorService, BehaviorService>();

// Configures the application's cookie for handling authentication sessions.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true; // Prevents client-side scripts from accessing the cookie.
    options.Cookie.SameSite = SameSiteMode.Strict; // Restricts cookie to first-party context.
    options.ExpireTimeSpan = TimeSpan.FromDays(7); // Sets cookie expiration time.
    options.SlidingExpiration = true; // Resets the expiration time on each request.
    options.Events.OnRedirectToLogin = context =>
    {
        // Prevents the default redirect to a login page and returns a 401 Unauthorized status instead.
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});

// Add CORS services
var allowedOrigins = builder.Configuration["ALLOWED_ORIGINS"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? new[] { "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            // Production: Vercel preview/prod deployments use unique subdomains (*.vercel.app).
            // We also allow explicit origins via ALLOWED_ORIGINS for custom domains.
            policy
                .SetIsOriginAllowed(origin =>
                {
                    if (string.IsNullOrWhiteSpace(origin)) return false;

                    // Exact-match allowlist (custom domains, local dev, etc.)
                    if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;

                    // Allow any Vercel deployment origin.
                    if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                    {
                        var host = uri.Host;
                        if (host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)) return true;
                    }

                    return false;
                })
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
});

var app = builder.Build();

// Swagger for development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Structured HTTP request log: method, path, status, elapsed. Replaces default access log.
app.UseSerilogRequestLogging(opts =>
{
    opts.EnrichDiagnosticContext = (diagCtx, httpCtx) =>
    {
        diagCtx.Set("RequestHost", httpCtx.Request.Host.Value);
        diagCtx.Set("UserAgent", httpCtx.Request.Headers.UserAgent.ToString());
    };
});

// Add request sanitization middleware for password-related endpoints
app.UseMiddleware<RequestSanitizationMiddleware>();

// Enable CORS
app.UseCors("AllowFrontend");

app.UseAuthentication(); // Enable authentication
app.UseAuthorization();

// Hangfire dashboard at /hangfire — open in Development, Admin-only in Production
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new HangfireDashboardAuthFilter()]
});

// Serve static image assets from the local Images/ directory at /images
var imagesPath = Path.Combine(Directory.GetCurrentDirectory(), "Images");
if (Directory.Exists(imagesPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(imagesPath),
        RequestPath = "/images"
    });
}

// Map controllers
app.MapControllers();

// Health check endpoints — unauthenticated, not included in Swagger
// /health/ready: checks all "ready"-tagged dependencies (postgres, redis, ai-service)
// /health/live:  trivial liveness — returns 200 if the process is running
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = WriteHealthCheckResponse
});
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = WriteHealthCheckResponse
});
// Bare /health alias for Docker Desktop UI polling (redirects to /health/live)
app.MapGet("/health", () => Results.Redirect("/health/live"));

// Optional: Auto apply migrations & seed
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TourbillonContext>();

    // Create the database if it doesn't exist. Development only: managed providers
    // (Neon) provision the database up front, so in production this only wakes the
    // serverless compute on every boot for a check that can never succeed.
    if (app.Environment.IsDevelopment())
    {
        try
        {
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            var connectionStringBuilder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
            var databaseName = connectionStringBuilder.Database;

            // Connect to the postgres maintenance database to create our database
            connectionStringBuilder.Database = "postgres";

            using (var conn = new Npgsql.NpgsqlConnection(connectionStringBuilder.ToString()))
            {
                await conn.OpenAsync();

                // Check if database exists
                using (var cmd = new Npgsql.NpgsqlCommand(
                    "SELECT 1 FROM pg_database WHERE datname = @name", conn))
                {
                    cmd.Parameters.AddWithValue("name", databaseName!);
                    var exists = await cmd.ExecuteScalarAsync();

                    if (exists == null)
                    {
                        // Database doesn't exist, create it. Identifiers cannot be
                        // parameterised, so quote it rather than interpolating raw.
                        var quotedName = "\"" + databaseName!.Replace("\"", "\"\"") + "\"";
                        using (var createCmd = new Npgsql.NpgsqlCommand($"CREATE DATABASE {quotedName}", conn))
                        {
                            await createCmd.ExecuteNonQueryAsync();
                            Console.WriteLine($"Created database: {databaseName}");
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Database creation check: {ex.Message}");
        }
    }

    context.Database.Migrate(); // Apply pending migrations
    DbInitializer.Initialize(context); // Seed initial data (9 Holy Trinity showcase watches)
    await DbInitializer.EnsureSlugsPopulated(context); // Populate empty slugs for URL routing

    // Ensure Admin role exists
    await DbInitializer.EnsureAdminSetupAsync(scope.ServiceProvider);

    // Startup is exactly when a pipeline version bump takes effect, so it is also when the
    // entries that bump just orphaned can be dropped. One DELETE; failure must not stop boot.
    try
    {
        await scope.ServiceProvider.GetRequiredService<QueryCacheService>().PurgeStaleAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Query cache purge skipped: {ex.Message}");
    }

    // Watch embeddings from a previous model are incomparable, not merely stale, so they are
    // dropped here and refilled in the background — regenerating over a thousand chunks inline
    // would hold up the boot the healthcheck is waiting on.
    try
    {
        var removed = await scope.ServiceProvider
            .GetRequiredService<WatchEmbeddingService>().PurgeForeignModelEmbeddingsAsync();
        if (removed > 0)
            BackgroundJob.Enqueue<WatchEmbeddingService>(service => service.GenerateMissingAsync());
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Embedding model check skipped: {ex.Message}");
    }
}

// Recurring jobs — Hangfire stores the schedule in its own tables and re-registers
// on every boot. Runs daily at 03:00 UTC.
RecurringJob.AddOrUpdate<BrowsingEventRetentionJob>(
    "browsing-event-retention",
    job => job.RunAsync(),
    "0 3 * * *");

// Starter answers are computed once and kept until the catalogue changes, so nothing runs on a
// schedule: startup fills in any that are missing and a catalogue edit re-warms them. The six-hourly job
// that used to regenerate all seven is removed from Hangfire's storage wherever it was registered.
// Local dev leaves ChatSettings:WarmStarters off, so a restart there never pays for starters.
RecurringJob.RemoveIfExists("chat-warm-starters");
if (app.Configuration.GetValue<bool>("ChatSettings:WarmStarters", true))
    BackgroundJob.Enqueue<ChatService>(service => service.WarmStartersAsync());

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// JSON health check response writer — used by both /health/live and /health/ready.
static Task WriteHealthCheckResponse(
    HttpContext ctx,
    Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report)
{
    ctx.Response.ContentType = "application/json";
    var result = System.Text.Json.JsonSerializer.Serialize(new
    {
        status = report.Status.ToString(),
        checks = report.Entries.Select(e => new
        {
            name        = e.Key,
            status      = e.Value.Status.ToString(),
            description = e.Value.Description,
            duration_ms = (long)e.Value.Duration.TotalMilliseconds
        })
    });
    return ctx.Response.WriteAsync(result);
}
