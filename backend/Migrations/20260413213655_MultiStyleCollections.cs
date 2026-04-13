using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class MultiStyleCollections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add new array column with empty-array default
            migrationBuilder.AddColumn<string[]>(
                name: "Styles",
                table: "Collections",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            // Migrate existing single-style values into the new array column
            migrationBuilder.Sql(
                """
                UPDATE "Collections"
                SET "Styles" = ARRAY["Style"]
                WHERE "Style" IS NOT NULL;
                """);

            // Drop the old single-style column
            migrationBuilder.DropColumn(
                name: "Style",
                table: "Collections");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-add old column
            migrationBuilder.AddColumn<string>(
                name: "Style",
                table: "Collections",
                type: "text",
                nullable: true);

            // Migrate back — take the first element of the array
            migrationBuilder.Sql(
                """
                UPDATE "Collections"
                SET "Style" = "Styles"[1]
                WHERE array_length("Styles", 1) > 0;
                """);

            migrationBuilder.DropColumn(
                name: "Styles",
                table: "Collections");
        }
    }
}
