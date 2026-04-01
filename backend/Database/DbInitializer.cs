using backend.Helpers;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Database
{
    // Responsible for startup initialisation: slug population and admin role seeding.
    // Brand, collection, and watch data is managed exclusively through the database —
    // CSV bootstrap files have been removed as the database is the source of truth.
    public static class DbInitializer
    {
        public static void Initialize(TourbillonContext context)
        {
            // No-op: all seed data lives in the database via EF migrations.
            // Kept as an entry point in case startup seeding is needed in future.
        }

        /// Populates empty Slug fields on Brand, Collection, and Watch rows.
        /// Runs on every startup — only touches rows where Slug is still empty.
        /// Appends a numeric suffix on collision (unlikely but defensive).
        public static async Task EnsureSlugsPopulated(TourbillonContext context)
        {
            var changed = false;

            // Brands
            var brands = await context.Brands.Where(b => b.Slug == "").ToListAsync();
            var brandSlugs = new HashSet<string>(
                await context.Brands.Where(b => b.Slug != "").Select(b => b.Slug).ToListAsync());
            foreach (var b in brands)
            {
                b.Slug = UniqueSlug(SlugHelper.GenerateSlug(b.Name), brandSlugs);
                changed = true;
            }

            // Collections (brand-prefixed to prevent collisions across brands)
            var collections = await context.Collections.Include(c => c.Brand)
                .Where(c => c.Slug == "").ToListAsync();
            var colSlugs = new HashSet<string>(
                await context.Collections.Where(c => c.Slug != "").Select(c => c.Slug).ToListAsync());
            foreach (var c in collections)
            {
                c.Slug = UniqueSlug(SlugHelper.GenerateSlug(c.Brand.Name, c.Name), colSlugs);
                changed = true;
            }

            // Watches (brand + collection + name)
            var watches = await context.Watches
                .Include(w => w.Brand).Include(w => w.Collection)
                .Where(w => w.Slug == "").ToListAsync();
            var watchSlugs = new HashSet<string>(
                await context.Watches.Where(w => w.Slug != "").Select(w => w.Slug).ToListAsync());
            foreach (var w in watches)
            {
                w.Slug = UniqueSlug(SlugHelper.GenerateSlug(w.Brand.Name, w.Collection?.Name, w.Name), watchSlugs);
                changed = true;
            }

            if (changed) await context.SaveChangesAsync();

            // Create unique indexes on Slug columns (idempotent — safe to run every startup).
            // Done here instead of EF migration so slugs are populated before uniqueness is enforced.
            await context.Database.ExecuteSqlRawAsync(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Brands_Slug" ON "Brands" ("Slug");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Collections_Slug" ON "Collections" ("Slug");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Watches_Slug" ON "Watches" ("Slug");
                """);
        }

        // Returns a unique slug by appending -2, -3, etc. if the base already exists
        private static string UniqueSlug(string baseSlug, HashSet<string> existing)
        {
            if (string.IsNullOrEmpty(baseSlug)) baseSlug = "unknown";
            var slug = baseSlug;
            var i = 2;
            while (!existing.Add(slug))
                slug = $"{baseSlug}-{i++}";
            return slug;
        }

        /// Ensures Admin role exists and seeds the configured admin email with the Admin role.
        /// Called from Program.cs after services are configured.
        public static async Task EnsureAdminSetupAsync(IServiceProvider serviceProvider)
        {
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole<int>>>();
            var userManager = serviceProvider.GetRequiredService<UserManager<User>>();
            var config = serviceProvider.GetRequiredService<IConfiguration>();

            // Ensure Admin role exists
            if (!await roleManager.RoleExistsAsync("Admin"))
            {
                var result = await roleManager.CreateAsync(new IdentityRole<int>("Admin"));
                Console.WriteLine(result.Succeeded
                    ? "Created 'Admin' role successfully"
                    : $"Failed to create 'Admin' role: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }

            // Assign Admin role to seed email if the user account already exists
            var seedEmail = config["AdminSettings:SeedAdminEmail"];
            if (string.IsNullOrWhiteSpace(seedEmail)) return;

            var user = await userManager.FindByEmailAsync(seedEmail);
            if (user == null)
            {
                Console.WriteLine($"Admin seed: user '{seedEmail}' not found yet, will assign on first sign-in.");
                return;
            }

            if (!await userManager.IsInRoleAsync(user, "Admin"))
            {
                var result = await userManager.AddToRoleAsync(user, "Admin");
                Console.WriteLine(result.Succeeded
                    ? $"Admin seed: assigned Admin role to '{seedEmail}'"
                    : $"Admin seed: failed for '{seedEmail}': {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }
        }
    }
}
