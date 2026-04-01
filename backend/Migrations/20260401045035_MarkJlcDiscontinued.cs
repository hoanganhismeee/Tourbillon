using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class MarkJlcDiscontinued : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Set productionStatus = "Discontinued" for all JLC (BrandId=4) watches with Price on Request (CurrentPrice=0).
            // Specs is stored as a JSON string — jsonb_set patches only the productionStatus key.
            migrationBuilder.Sql("""
                UPDATE "Watches"
                SET "Specs" = jsonb_set(
                    COALESCE("Specs"::jsonb, '{}'::jsonb),
                    '{productionStatus}',
                    '"Discontinued"'
                )::text
                WHERE "BrandId" = 4 AND "CurrentPrice" = 0;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert: clear productionStatus for the same set of watches.
            migrationBuilder.Sql("""
                UPDATE "Watches"
                SET "Specs" = jsonb_set(
                    COALESCE("Specs"::jsonb, '{}'::jsonb),
                    '{productionStatus}',
                    'null'
                )::text
                WHERE "BrandId" = 4 AND "CurrentPrice" = 0;
            """);
        }
    }
}
