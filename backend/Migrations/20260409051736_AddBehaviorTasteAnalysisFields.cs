using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddBehaviorTasteAnalysisFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BehaviorAnalyzedAt",
                table: "UserTasteProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BehaviorPreferredBrandIds",
                table: "UserTasteProfiles",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "BehaviorPreferredCaseSize",
                table: "UserTasteProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BehaviorPreferredDialColors",
                table: "UserTasteProfiles",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "BehaviorPreferredMaterials",
                table: "UserTasteProfiles",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<decimal>(
                name: "BehaviorPriceMax",
                table: "UserTasteProfiles",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BehaviorPriceMin",
                table: "UserTasteProfiles",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BehaviorAnalyzedAt",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPreferredBrandIds",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPreferredCaseSize",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPreferredDialColors",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPreferredMaterials",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPriceMax",
                table: "UserTasteProfiles");

            migrationBuilder.DropColumn(
                name: "BehaviorPriceMin",
                table: "UserTasteProfiles");
        }
    }
}
