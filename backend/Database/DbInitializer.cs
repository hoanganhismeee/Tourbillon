using backend.Models;
using System.Globalization;
using CsvHelper;
using System.IO;
using CsvHelper.Configuration;

namespace backend.Database
{
    // Responsible for seeding initial data into the database (like default brands).
    // dotnet ef database drop --force && dotnet ef database update
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
                        c.Brand = null;
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
            // Always try to seed collections (it will skip if already present)
            SeedCollectionsFromCsv(context);
        }
    }
}
