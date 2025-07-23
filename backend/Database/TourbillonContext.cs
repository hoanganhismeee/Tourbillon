// This file defines the database context for the application, which is responsible for managing the connection to the database and mapping the models to the database tables.
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace backend.Database;

public class TourbillonContext : IdentityDbContext<User, IdentityRole<int>, int>
{
    public TourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

    public DbSet<Watch> Watches { get; set; } // also covers current price
    public DbSet<Brand> Brands { get; set; } //brand data

    public DbSet<Collection> Collections { get; set; } //brand's specific watches collection
    public DbSet<PriceTrend> PriceTrends { get; set; } //price history
}
