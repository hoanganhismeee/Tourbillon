using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddWatchEditorial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WatchEditorialContents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SeedWatchId = table.Column<int>(type: "integer", nullable: false),
                    WhyItMatters = table.Column<string>(type: "text", nullable: false),
                    CollectorAppeal = table.Column<string>(type: "text", nullable: false),
                    DesignLanguage = table.Column<string>(type: "text", nullable: false),
                    BestFor = table.Column<string>(type: "text", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WatchEditorialContents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WatchEditorialContents_Watches_SeedWatchId",
                        column: x => x.SeedWatchId,
                        principalTable: "Watches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WatchEditorialLinks",
                columns: table => new
                {
                    WatchId = table.Column<int>(type: "integer", nullable: false),
                    EditorialContentId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WatchEditorialLinks", x => x.WatchId);
                    table.ForeignKey(
                        name: "FK_WatchEditorialLinks_WatchEditorialContents_EditorialContent~",
                        column: x => x.EditorialContentId,
                        principalTable: "WatchEditorialContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WatchEditorialLinks_Watches_WatchId",
                        column: x => x.WatchId,
                        principalTable: "Watches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WatchEditorialContents_SeedWatchId",
                table: "WatchEditorialContents",
                column: "SeedWatchId");

            migrationBuilder.CreateIndex(
                name: "IX_WatchEditorialLinks_EditorialContentId",
                table: "WatchEditorialLinks",
                column: "EditorialContentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WatchEditorialLinks");

            migrationBuilder.DropTable(
                name: "WatchEditorialContents");
        }
    }
}
