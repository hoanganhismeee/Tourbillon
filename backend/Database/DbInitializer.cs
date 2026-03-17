using backend.Models;
using System.Globalization;
using CsvHelper;
using System.IO;
using CsvHelper.Configuration;
using CsvHelper.Configuration.Attributes;
using Microsoft.EntityFrameworkCore;

namespace backend.Database
{

    // Responsible for seeding initial data into the database (like default brands).
    // dotnet ef database drop --force && dotnet ef database update && dotnet run
    // close hết tất cả csv trước khi chạy
    // dotnet ef migrations add AddCollections && dotnet ef database update (mỗi khi thêm model mới thì phải làm cái này)

    // make sure to dotnet run so pgadmin shows the updated database
    public static class DbInitializer
    {
        public static void SeedCollectionsFromCsv(TourbillonContext context)
        {
            // Skip seeding if collections already exist in the database
            if (context.Collections.Any()) return;

            var csvPath = Path.Combine("Data", "collections.csv");
            if (!File.Exists(csvPath))
                throw new FileNotFoundException($"collections.csv not found at {csvPath}");

            using (var reader = new StreamReader(csvPath))
            {
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HeaderValidated = null, // Ignore missing headers
                    MissingFieldFound = null, // Ignore missing fields
                    TrimOptions = TrimOptions.Trim,
                };
                using (var csv = new CsvReader(reader, config))
                {
                    var collections = csv.GetRecords<Collection>().ToList();
                    foreach (var c in collections)
                    {
                        // Ensure navigation property is not set to avoid EF Core tracking issues
                        c.Brand = null!;
                        // Check if collection already exists (by name and BrandId)
                        if (!context.Collections.Any(x => x.Name == c.Name && x.BrandId == c.BrandId))
                        {
                            context.Collections.Add(c);
                        }
                    }
                    context.SaveChanges();
                }
            }
        }


        // CSV record class for watches
        private class WatchCsvRecord
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public int BrandId { get; set; }
            public int? CollectionId { get; set; }
            public string CurrentPrice { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public string Specs { get; set; } = string.Empty;
            public string Image { get; set; } = string.Empty;
        }

        public static void SeedWatchesFromCsv(TourbillonContext context)
        {
            // Only seed the 9 showcase watches from CSV
            var showcaseWatchIds = new HashSet<int> { 1, 2, 3, 32, 33, 34, 57, 58, 59 };

            var csvPath = Path.Combine("Data", "watches.csv");
            if (!File.Exists(csvPath))
            {
                Console.WriteLine($"watches.csv not found at {csvPath}, skipping showcase watch seeding");
                return;
            }

            using (var reader = new StreamReader(csvPath))
            {
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HeaderValidated = null,
                    MissingFieldFound = null,
                    TrimOptions = TrimOptions.Trim,
                };
                using (var csv = new CsvReader(reader, config))
                {
                    var records = csv.GetRecords<WatchCsvRecord>().ToList();
                    int seededCount = 0;
                    
                    foreach (var record in records)
                    {
                        // Only seed showcase watches
                        if (!showcaseWatchIds.Contains(record.Id))
                            continue;

                        // Check if watch already exists
                        if (context.Watches.Any(w => w.Id == record.Id))
                            continue;

                        decimal price = 0;
                        if (!string.IsNullOrEmpty(record.CurrentPrice))
                        {
                            var cleanPrice = record.CurrentPrice.Replace(",", "").Trim();
                            decimal.TryParse(cleanPrice, out price);
                        }

                        var watch = new Watch
                        {
                            Id = record.Id,
                            Name = record.Name,
                            BrandId = record.BrandId,
                            CollectionId = record.CollectionId,
                            CurrentPrice = price,
                            Description = record.Description,
                            Specs = record.Specs,
                            Image = record.Image
                        };

                        context.Watches.Add(watch);
                        seededCount++;
                    }

                    if (seededCount > 0)
                    {
                        context.SaveChanges();
                        Console.WriteLine($"Seeded {seededCount} showcase watches from CSV");

                        // Reset the PostgreSQL sequence to avoid ID conflicts when scraping new watches
                        // The highest showcase watch ID is 59, so we start the sequence from 60
                        ResetWatchIdSequence(context, 60);
                    }
                    else
                    {
                        Console.WriteLine("Showcase watches already exist, skipping CSV seed");

                        // Even if watches exist, make sure sequence is properly set
                        ResetWatchIdSequence(context, 36);
                    }
                }
            }
        }

        public static void Initialize(TourbillonContext context)
        {
            // Seed brands if needed
            if (!context.Brands.Any())
            {
                var csvPath = Path.Combine("Data", "brands.csv");
                if (!File.Exists(csvPath))
                    throw new FileNotFoundException($"brands.csv not found at {csvPath}");

                using (var reader = new StreamReader(csvPath))
                using (var csv = new CsvReader(reader, CultureInfo.InvariantCulture))
                {
                    var brands = csv.GetRecords<Brand>().ToList();
                    foreach (var b in brands)
                    {
                        if (!context.Brands.Any(x => x.Name == b.Name))
                        {
                            context.Brands.Add(b);
                        }
                    }
                    context.SaveChanges();
                }
            }

            // Seed collections from CSV (contains descriptions and heritage information)
            SeedCollectionsFromCsv(context);

            // Seed the 9 showcase watches from CSV with their curated images
            // IDs: 2, 4, 11, 13, 18, 24, 28, 30, 35
            SeedWatchesFromCsv(context);
        }

        /// Ensures Admin role exists in the database
        /// Call this from Program.cs after services are configured
        public static async Task EnsureAdminRoleAsync(IServiceProvider serviceProvider)
        {
            var roleManager = serviceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<Microsoft.AspNetCore.Identity.IdentityRole<int>>>();

            // Check if Admin role exists
            if (!await roleManager.RoleExistsAsync("Admin"))
            {
                // Create Admin role
                var result = await roleManager.CreateAsync(new Microsoft.AspNetCore.Identity.IdentityRole<int>("Admin"));
                if (result.Succeeded)
                {
                    Console.WriteLine("Created 'Admin' role successfully");
                }
                else
                {
                    Console.WriteLine($"Failed to create 'Admin' role: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                }
            }
            else
            {
                Console.WriteLine("'Admin' role already exists");
            }
        }

        /// Resets the PostgreSQL auto-increment sequence for Watch IDs
        /// This prevents ID conflicts when inserting new scraped watches
        private static void ResetWatchIdSequence(TourbillonContext context, int startValue)
        {
            try
            {
                // Get the maximum Watch ID from the database
                var maxId = context.Watches.Any()
                    ? context.Watches.Max(w => w.Id)
                    : 0;

                // Use the higher of the two values (startValue or maxId + 1)
                var nextId = Math.Max(startValue, maxId + 1);

                // Reset PostgreSQL sequence to start from nextId
                var sql = $"SELECT setval(pg_get_serial_sequence('\"Watches\"', 'Id'), {nextId}, false);";
                context.Database.ExecuteSqlRaw(sql);

                Console.WriteLine($"Reset Watch ID sequence to start from {nextId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Could not reset Watch ID sequence: {ex.Message}");
            }
        }
    }
}
