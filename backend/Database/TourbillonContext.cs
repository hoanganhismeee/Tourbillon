using Microsoft.EntityFrameworkCore;
using backend.Models;

namespace backend.Database;

public class TourbillonContext : DbContext
{
    public TourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

    public DbSet<Watch> Watches { get; set; } // also covers current price
    public DbSet<Brand> Brands { get; set; }
    public DbSet<PriceTrend> PriceTrends { get; set; }
    public DbSet<User> Users { get; set; }
}
