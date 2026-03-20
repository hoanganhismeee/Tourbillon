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
    }
}
