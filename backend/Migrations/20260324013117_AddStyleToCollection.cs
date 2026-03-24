using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddStyleToCollection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Style",
                table: "Collections",
                type: "text",
                nullable: true);

            // Data migration: seed style taxonomy for all known collections.
            // Null = uncategorized (style resolved at runtime via watch specs).
            migrationBuilder.Sql(@"
                UPDATE ""Collections"" SET ""Style"" = 'sport'
                WHERE ""Name"" IN (
                    'Nautilus','Royal Oak','Royal Oak Offshore','Royal Oak Concept',
                    'Overseas','Aquanaut','Highlife','lineSport','Sport Collection',
                    'GMT-Master II','Seamaster','Spezialist');

                UPDATE ""Collections"" SET ""Style"" = 'dress'
                WHERE ""Name"" IN (
                    'Calatrava','Patrimony','Saxonia','Classique','Reverso',
                    'Master Ultra Thin','Senator','Slimline','Elegance Collection',
                    'De Ville','Tradition','1815','Lange 1','Datejust','Day-Date',
                    'Historiques','Métiers d''Art','Heritage Collection','Classics',
                    'Reine de Naples','élégante','PanoMatic','Duomètre','Manufacture',
                    'Constellation','Zeitwerk','Collection','Collection Convexe',
                    'Datograph','Evolution 9');

                UPDATE ""Collections"" SET ""Style"" = 'diver'
                WHERE ""Name"" IN ('Submariner','SeaQ','Polaris','Marine');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Style",
                table: "Collections");
        }
    }
}
