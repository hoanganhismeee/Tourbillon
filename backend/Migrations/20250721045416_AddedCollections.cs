// This migration introduces the 'Collections' entity to the database.
// It adds a new 'Collections' table and links it to the existing 'Watches' table
// by adding a 'CollectionId' foreign key, allowing watches to be organized into collections.
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{

    /// <inheritdoc />
    public partial class AddedCollections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) // Applies the migration to add the Collections table and link it to Watches.
        {
            migrationBuilder.AddColumn<int>(
                name: "CollectionId",
                table: "Watches",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Collections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Image = table.Column<string>(type: "text", nullable: true),
                    BrandId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Collections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Collections_Brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Watches_CollectionId",
                table: "Watches",
                column: "CollectionId");

            migrationBuilder.CreateIndex(
                name: "IX_Collections_BrandId",
                table: "Collections",
                column: "BrandId");

            migrationBuilder.AddForeignKey(
                name: "FK_Watches_Collections_CollectionId",
                table: "Watches",
                column: "CollectionId",
                principalTable: "Collections",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) // Reverts the migration by removing the Collections table and the foreign key from Watches.
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Watches_Collections_CollectionId",
                table: "Watches");

            migrationBuilder.DropTable(
                name: "Collections");

            migrationBuilder.DropIndex(
                name: "IX_Watches_CollectionId",
                table: "Watches");

            migrationBuilder.DropColumn(
                name: "CollectionId",
                table: "Watches");
        }
    }
}
