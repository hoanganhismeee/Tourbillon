using backend.Database;
using backend.Models;
using backend.Services;
using backend.Middleware;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add memory cache for rate limiting
builder.Services.AddMemoryCache();

// Add DbContext (PostgreSQL)
builder.Services.AddDbContext<TourbillonContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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
.AddEntityFrameworkStores<TourbillonContext>(); // Links Identity to the Entity Framework data store.

// Register secure password change service
builder.Services.AddScoped<IPasswordChangeService, PasswordChangeService>();

// Register rate limiting service
builder.Services.AddScoped<IPasswordChangeRateLimitService, PasswordChangeRateLimitService>();

// Register SOLID refactored services
builder.Services.AddScoped<IUserRegistrationService, UserRegistrationService>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<IAccountDeletionService, AccountDeletionService>();

// Configure SMTP settings
builder.Services.Configure<backend.Services.SmtpOptions>(
    builder.Configuration.GetSection(backend.Services.SmtpOptions.SectionName));

// Register email and password reset services
builder.Services.AddScoped<backend.Services.IEmailService, backend.Services.EmailService>();
builder.Services.AddScoped<backend.Services.IPasswordResetService, backend.Services.PasswordResetService>();

// Register currency converter and showcase watch mapping as singletons (stateless, thread-safe)
builder.Services.AddSingleton<CurrencyConverter>();

// Register Cloudinary service for image uploads
builder.Services.AddSingleton<ICloudinaryService, CloudinaryService>();

// Register watch cache service for database operations
builder.Services.AddScoped<WatchCacheService>();

// Register brand-specific scraper service for official brand websites
builder.Services.AddScoped<BrandScraperService>();

// Configures the application's cookie for handling authentication sessions.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true; // Prevents client-side scripts from accessing the cookie.
    options.Cookie.SameSite = SameSiteMode.Strict; // Restricts cookie to first-party context.
    options.ExpireTimeSpan = TimeSpan.FromMinutes(30); // Sets cookie expiration time.
    options.SlidingExpiration = true; // Resets the expiration time on each request.
    options.Events.OnRedirectToLogin = context =>
    {
        // Prevents the default redirect to a login page and returns a 401 Unauthorized status instead.
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});

// Add CORS services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        builder =>
        {
            builder.WithOrigins("http://localhost:3000") // The origin of your frontend app
                   .AllowAnyHeader()
                   .AllowAnyMethod()
                   .AllowCredentials(); // Allow credentials (cookies)
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

// Add request sanitization middleware for password-related endpoints
app.UseMiddleware<RequestSanitizationMiddleware>();

// Enable CORS
app.UseCors("AllowFrontend");

app.UseAuthentication(); // Enable authentication
app.UseAuthorization();

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

// Optional: Auto apply migrations & seed
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TourbillonContext>();

    // Create database if it doesn't exist (for Neon cloud)
    try
    {
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        var connectionStringBuilder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        var databaseName = connectionStringBuilder.Database;

        // Connect to postgres database to create our database
        connectionStringBuilder.Database = "postgres";

        using (var conn = new Npgsql.NpgsqlConnection(connectionStringBuilder.ToString()))
        {
            await conn.OpenAsync();

            // Check if database exists
            using (var cmd = new Npgsql.NpgsqlCommand($"SELECT 1 FROM pg_database WHERE datname = '{databaseName}'", conn))
            {
                var exists = await cmd.ExecuteScalarAsync();

                if (exists == null)
                {
                    // Database doesn't exist, create it
                    using (var createCmd = new Npgsql.NpgsqlCommand($"CREATE DATABASE {databaseName}", conn))
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

    context.Database.Migrate(); // Apply pending migrations
    DbInitializer.Initialize(context); // Seed initial data (9 Holy Trinity showcase watches)
}

app.Run();
