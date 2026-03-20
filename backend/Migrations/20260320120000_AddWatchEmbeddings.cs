using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using Pgvector;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddWatchEmbeddings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Enable pgvector extension (idempotent)
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS vector;");

            migrationBuilder.CreateTable(
                name: "WatchEmbeddings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WatchId = table.Column<int>(type: "integer", nullable: false),
                    ChunkType = table.Column<string>(type: "text", nullable: false),
                    ChunkText = table.Column<string>(type: "text", nullable: false),
                    Embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WatchEmbeddings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WatchEmbeddings_Watches_WatchId",
                        column: x => x.WatchId,
                        principalTable: "Watches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WatchEmbeddings_WatchId_ChunkType",
                table: "WatchEmbeddings",
                columns: new[] { "WatchId", "ChunkType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "WatchEmbeddings");
        }
    }
}
