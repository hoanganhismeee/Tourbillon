using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddFeatureColumnAndQueryCacheHnswIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Feature",
                table: "WatchEmbeddings",
                type: "text",
                nullable: false,
                defaultValue: "watch_finder");

            migrationBuilder.AddColumn<string>(
                name: "Feature",
                table: "QueryCaches",
                type: "text",
                nullable: false,
                defaultValue: "watch_finder");

            // Backfill: existing QueryCache rows are all occasion/personality queries (Phase 5 scope)
            migrationBuilder.Sql("UPDATE \"QueryCaches\" SET \"Feature\" = 'rag_chat';");

            // Existing WatchEmbeddings are all watch_finder — defaultValue above handles them.

            // HNSW index on QueryCaches — previously missing, causing full table scan on every lookup.
            migrationBuilder.Sql(@"CREATE INDEX ix_query_caches_hnsw
                ON ""QueryCaches"" USING hnsw (""QueryEmbedding"" vector_cosine_ops);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ix_query_caches_hnsw;");

            migrationBuilder.DropColumn(
                name: "Feature",
                table: "WatchEmbeddings");

            migrationBuilder.DropColumn(
                name: "Feature",
                table: "QueryCaches");
        }
    }
}
