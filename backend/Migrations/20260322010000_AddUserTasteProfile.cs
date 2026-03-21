using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTasteProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserTasteProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TasteText = table.Column<string>(type: "text", nullable: true),
                    PreferredBrandIds = table.Column<string>(type: "text", nullable: false, defaultValue: "[]"),
                    PreferredMaterials = table.Column<string>(type: "text", nullable: false, defaultValue: "[]"),
                    PreferredDialColors = table.Column<string>(type: "text", nullable: false, defaultValue: "[]"),
                    PriceMin = table.Column<decimal>(type: "numeric", nullable: true),
                    PriceMax = table.Column<decimal>(type: "numeric", nullable: true),
                    PreferredCaseSize = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTasteProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTasteProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTasteProfiles_UserId",
                table: "UserTasteProfiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserTasteProfiles");
        }
    }
}
