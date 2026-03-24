// This file defines the database context for the application, which is responsible for managing the connection to the database and mapping the models to the database tables.
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace backend.Database;

public class TourbillonContext : IdentityDbContext<User, IdentityRole<int>, int>
{
    public TourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

    public DbSet<Watch> Watches { get; set; }
    public DbSet<Brand> Brands { get; set; }
    public DbSet<Collection> Collections { get; set; }
    public DbSet<PriceTrend> PriceTrends { get; set; }
    public DbSet<WatchEmbedding> WatchEmbeddings { get; set; }
    public DbSet<QueryCache> QueryCaches { get; set; }
    public DbSet<UserTasteProfile> UserTasteProfiles { get; set; }
    public DbSet<WatchEditorialContent> WatchEditorialContents { get; set; }
    public DbSet<WatchEditorialLink> WatchEditorialLinks { get; set; }
    public DbSet<ContactInquiry> ContactInquiries { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<RegisterInterest> RegisterInterests { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Enable pgvector extension
        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.Entity<WatchEmbedding>(entity =>
        {
            // 768 dimensions — nomic-embed-text output size
            entity.Property(e => e.Embedding).HasColumnType("vector(768)");

            // One row per (watch, chunk_type) — upsert logic deletes + reinserts
            entity.HasIndex(e => new { e.WatchId, e.ChunkType }).IsUnique();
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
    }
}
