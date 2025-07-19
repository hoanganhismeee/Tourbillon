using backend.Models;

namespace backend.Database
{
    public static class DbInitializer
    {
        public static void Initialize(TourbillonContext context)
        {
            if (context.Brands.Any()) return; // Already seeded

            var brands = new List<Brand>
            {
                new Brand { Name = "Rolex", Description = "Swiss luxury", Image = "rolex.png" },
                new Brand { Name = "Omega", Description = "Iconic Swiss watches", Image = "omega.png" }
            };

            context.Brands.AddRange(brands);
            context.SaveChanges();
        }
    }
}
