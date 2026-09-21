// This file defines the database context for the application, which is responsible for managing the connection to the database and mapping the models to the database tables.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace backend.Database;

public class TourbillonContext : IdentityDbContext<User, IdentityRole<int>, int>
{
    // Redis, when the app wires it. Catalogue writes invalidate every cached concierge answer, and
    // doing that here rather than at each endpoint means no write path can forget it: a price edited
    // in the admin used to leave the cached answer quoting the old one until someone ran INCR by hand.
    private readonly IRedisService? _redis;
    private readonly ILogger<TourbillonContext>? _logger;

    public TourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

    public TourbillonContext(
        DbContextOptions<TourbillonContext> options,
        IRedisService redis,
        ILogger<TourbillonContext> logger) : base(options)
    {
        _redis = redis;
        _logger = logger;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var catalogueChanged = _redis != null && HasCatalogueChanges();
        var written = await base.SaveChangesAsync(cancellationToken);

        if (catalogueChanged && written > 0)
        {
            try
            {
                // Bump only. Starter answers are recomputed by the warm-up job or by the first visitor
                // who asks for one, so invalidating costs nothing by itself.
                await _redis!.IncrementAsync(ChatCacheKeys.ResponseVersion);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Catalogue changed but the concierge reply cache was not invalidated");
            }
        }

        return written;
    }

    /// True when this save adds, changes or removes a watch, brand or collection — the three things a
    /// cached concierge answer talks about.
    private bool HasCatalogueChanges() =>
        ChangeTracker.Entries().Any(entry =>
            entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
            && entry.Entity is Watch or Brand or Collection);

    public DbSet<Watch> Watches { get; set; }
    public DbSet<Brand> Brands { get; set; }
    public DbSet<Collection> Collections { get; set; }
public DbSet<WatchEmbedding> WatchEmbeddings { get; set; }
    public DbSet<QueryCache> QueryCaches { get; set; }
    public DbSet<UserTasteProfile> UserTasteProfiles { get; set; }
    public DbSet<WatchEditorialContent> WatchEditorialContents { get; set; }
    public DbSet<WatchEditorialLink> WatchEditorialLinks { get; set; }
    public DbSet<ContactInquiry> ContactInquiries { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<RegisterInterest> RegisterInterests { get; set; }
    public DbSet<UserFavourite> UserFavourites { get; set; }
    public DbSet<UserCollection> UserCollections { get; set; }
    public DbSet<UserCollectionWatch> UserCollectionWatches { get; set; }
    public DbSet<UserBrowsingEvent> UserBrowsingEvents { get; set; }
    public DbSet<MediaAsset> MediaAssets { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Enable pgvector extension
        modelBuilder.HasPostgresExtension("vector");

        // Unique slug indexes on Brands/Collections/Watches are created at
        // startup by DbInitializer.EnsureSlugsPopulated (raw SQL, idempotent)
        // because indexes must come after empty default slugs are filled.

        modelBuilder.Entity<WatchEmbedding>(entity =>
        {
            // 768 dimensions — nomic-embed-text output size
            entity.Property(e => e.Embedding).HasColumnType("vector(768)");

            // One row per (watch, chunk_type, feature) — allows multiple features per watch
            entity.HasIndex(e => new { e.WatchId, e.ChunkType, e.Feature }).IsUnique();
        });

        modelBuilder.Entity<QueryCache>(entity =>
        {
            entity.Property(e => e.QueryEmbedding).HasColumnType("vector(768)");
        });

        modelBuilder.Entity<UserTasteProfile>(entity =>
        {
            // One taste profile per user
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.PreferredBrandIds).HasDefaultValue("[]");
            entity.Property(e => e.PreferredMaterials).HasDefaultValue("[]");
            entity.Property(e => e.PreferredDialColors).HasDefaultValue("[]");
            entity.Property(e => e.BehaviorPreferredBrandIds).HasDefaultValue("[]");
            entity.Property(e => e.BehaviorPreferredMaterials).HasDefaultValue("[]");
            entity.Property(e => e.BehaviorPreferredDialColors).HasDefaultValue("[]");
        });

        modelBuilder.Entity<WatchEditorialLink>(entity =>
        {
            // WatchId is the PK — one editorial per watch
            entity.HasKey(e => e.WatchId);
        });

        modelBuilder.Entity<ContactInquiry>(entity =>
        {
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.HasIndex(e => e.CustomerEmail);
            entity.HasIndex(e => e.AppointmentDate);
        });

        modelBuilder.Entity<RegisterInterest>(entity =>
        {
            entity.HasIndex(e => e.CustomerEmail);
        });

        modelBuilder.Entity<UserFavourite>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.WatchId });
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<UserCollection>(entity =>
        {
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<UserCollectionWatch>(entity =>
        {
            entity.HasKey(e => new { e.UserCollectionId, e.WatchId });
        });

        modelBuilder.Entity<UserBrowsingEvent>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.AnonymousId);
            entity.HasIndex(e => e.Timestamp);
        });
    }
}
