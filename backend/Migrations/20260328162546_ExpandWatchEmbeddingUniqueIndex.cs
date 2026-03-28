using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ExpandWatchEmbeddingUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WatchEmbeddings_WatchId_ChunkType",
                table: "WatchEmbeddings");

            migrationBuilder.CreateIndex(
                name: "IX_WatchEmbeddings_WatchId_ChunkType_Feature",
                table: "WatchEmbeddings",
                columns: new[] { "WatchId", "ChunkType", "Feature" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WatchEmbeddings_WatchId_ChunkType_Feature",
                table: "WatchEmbeddings");

            migrationBuilder.CreateIndex(
                name: "IX_WatchEmbeddings_WatchId_ChunkType",
                table: "WatchEmbeddings",
                columns: new[] { "WatchId", "ChunkType" },
                unique: true);
        }
    }
}
