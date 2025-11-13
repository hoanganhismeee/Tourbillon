using backend.Models;
using System.Globalization;
using CsvHelper;
using System.IO;
using CsvHelper.Configuration;
using CsvHelper.Configuration.Attributes;

namespace backend.Database
{
    // Custom CSV mapping for watches to handle price parsing
    public class WatchCsvRecord
    {
        [Name("Id")]
        public int Id { get; set; }
        
        [Name("Name")]
        public string Name { get; set; } = string.Empty;
        
        [Name("BrandId")]
        public int BrandId { get; set; }
        
        [Name("CollectionId")]
        public int? CollectionId { get; set; }
        
        [Name("CurrentPrice")]
        public string CurrentPrice { get; set; } = string.Empty;
        
        [Name("Description")]
        public string? Description { get; set; }
        
        [Name("Specs")]
        public string? Specs { get; set; }
        
        [Name("Image")]
        public string? Image { get; set; }
    }

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

        public static void SeedWatchesFromCsv(TourbillonContext context)
        {
            // Skip seeding if watches already exist in the database
            if (context.Watches.Any()) 
            {
                Console.WriteLine("Watches already exist in database, skipping seeding.");
                return;
            }

            var csvPath = Path.Combine("Data", "watches.csv");
            if (!File.Exists(csvPath))
                throw new FileNotFoundException($"watches.csv not found at {csvPath}");

            Console.WriteLine($"Starting to seed watches from {csvPath}");

            // Holy Trinity showcase watches - only load these from CSV
            // The rest will come from the Watch API
            // These IDs match what the frontend expects in TrinityShowcase.tsx
            var showcaseWatchIds = new HashSet<int>
            {
                2,  // Patek Philippe - Calatrava
                4,  // Patek Philippe - Nautilus
                11, // Patek Philippe - Aquanaut
                13, // Vacheron Constantin - Patrimony
                18, // Vacheron Constantin - Overseas
                24, // Vacheron Constantin - Historiques
                28, // Audemars Piguet - Royal Oak
                30, // Audemars Piguet - Royal Oak Offshore
                35  // Audemars Piguet - Royal Oak Concept
            };

            try
            {
                var lines = File.ReadAllLines(csvPath);
                Console.WriteLine($"CSV file has {lines.Length} lines");

                // Skip header line
                var dataLines = lines.Skip(1).ToList();
                int addedCount = 0;
                int skippedCount = 0;

                foreach (var line in dataLines)
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    try
                    {
                        // Simple CSV parsing - split by comma but handle quoted fields
                        var fields = ParseCsvLine(line);

                        if (fields.Length < 8) continue; // Skip incomplete lines

                        // Parse fields
                        if (!int.TryParse(fields[0], out int id)) continue;

                        // IMPORTANT: Only load showcase watches from CSV
                        // All other watches will be fetched from the Watch API
                        if (!showcaseWatchIds.Contains(id))
                        {
                            skippedCount++;
                            continue;
                        }

                        var name = fields[1]?.Trim('"');
                        if (!int.TryParse(fields[2], out int brandId)) continue;
                        int? collectionId = int.TryParse(fields[3], out int cid) ? cid : null;
                        var currentPrice = fields[4]?.Trim('"');
                        var description = fields[5]?.Trim('"');
                        var specs = fields[6]?.Trim('"');
                        var image = fields[7]?.Trim('"');

                        // Skip if essential fields are missing
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        
                        // Parse price - handle "Price on request" and comma-separated numbers
                        decimal price = 0;
                        if (!string.IsNullOrEmpty(currentPrice) && 
                            currentPrice.ToLower() != "price on request")
                        {
                            // Remove commas and try to parse
                            var cleanPrice = currentPrice.Replace(",", "");
                            if (decimal.TryParse(cleanPrice, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedPrice))
                            {
                                price = parsedPrice;
                            }
                        }
                        
                        var watch = new Watch
                        {
                            Id = id,
                            Name = name,
                            BrandId = brandId,
                            CollectionId = collectionId,
                            CurrentPrice = price,
                            Description = description,
                            Specs = specs,
                            Image = image
                        };
                        
                        // Check if watch already exists (by name and BrandId)
                        if (!context.Watches.Any(x => x.Name == watch.Name && x.BrandId == watch.BrandId))
                        {
                            context.Watches.Add(watch);
                            addedCount++;
                            Console.WriteLine($"Added watch: {watch.Name} (ID: {watch.Id})");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error parsing line: {line.Substring(0, Math.Min(50, line.Length))}... Error: {ex.Message}");
                        continue;
                    }
                }
                
                context.SaveChanges();
                Console.WriteLine($"Successfully added {addedCount} showcase watches from CSV (skipped {skippedCount} watches - will be loaded from API)");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error reading CSV file: {ex.Message}");
            }
        }
        
        private static string[] ParseCsvLine(string line)
        {
            var fields = new List<string>();
            var currentField = new System.Text.StringBuilder();
            bool inQuotes = false;
            
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // Escaped quote
                        currentField.Append('"');
                        i++; // Skip next quote
                    }
                    else
                    {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    // End of field
                    fields.Add(currentField.ToString());
                    currentField.Clear();
                }
                else
                {
                    currentField.Append(c);
                }
            }
            
            // Add the last field
            fields.Add(currentField.ToString());
            
            return fields.ToArray();
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
            // Always try to seed watches (it will skip if already present)
            SeedWatchesFromCsv(context);
        }
    }
}
