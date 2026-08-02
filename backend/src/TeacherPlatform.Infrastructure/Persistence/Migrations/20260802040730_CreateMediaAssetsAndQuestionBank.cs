using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateMediaAssetsAndQuestionBank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MediaAssets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaAssets", x => x.Id);
                    table.UniqueConstraint("AK_MediaAssets_Id_TenantId", x => new { x.Id, x.TenantId });
                });

            migrationBuilder.CreateTable(
                name: "QuestionBanks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBanks", x => x.Id);
                    table.UniqueConstraint("AK_QuestionBanks_Id_TenantId", x => new { x.Id, x.TenantId });
                });

            migrationBuilder.CreateTable(
                name: "QuestionTags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionTags", x => x.Id);
                    table.UniqueConstraint("AK_QuestionTags_Id_TenantId", x => new { x.Id, x.TenantId });
                });

            migrationBuilder.CreateTable(
                name: "Questions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Questions", x => x.Id);
                    table.UniqueConstraint("AK_Questions_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Questions_QuestionBanks_BankId_TenantId",
                        columns: x => new { x.BankId, x.TenantId },
                        principalTable: "QuestionBanks",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "QuestionTagLinks",
                columns: table => new
                {
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionTagLinks", x => new { x.QuestionId, x.TagId });
                    table.ForeignKey(
                        name: "FK_QuestionTagLinks_QuestionTags_TagId_TenantId",
                        columns: x => new { x.TagId, x.TenantId },
                        principalTable: "QuestionTags",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_QuestionTagLinks_Questions_QuestionId_TenantId",
                        columns: x => new { x.QuestionId, x.TenantId },
                        principalTable: "Questions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "QuestionVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    QuestionType = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Explanation = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Difficulty = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ConfigJson = table.Column<string>(type: "jsonb", nullable: false),
                    MediaAssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionVersions", x => x.Id);
                    table.UniqueConstraint("AK_QuestionVersions_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_QuestionVersions_MediaAssets_MediaAssetId_TenantId",
                        columns: x => new { x.MediaAssetId, x.TenantId },
                        principalTable: "MediaAssets",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_QuestionVersions_Questions_QuestionId_TenantId",
                        columns: x => new { x.QuestionId, x.TenantId },
                        principalTable: "Questions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "QuestionOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    OptionText = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionOptions_QuestionVersions_QuestionVersionId_TenantId",
                        columns: x => new { x.QuestionVersionId, x.TenantId },
                        principalTable: "QuestionVersions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_ObjectKey",
                table: "MediaAssets",
                column: "ObjectKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_TenantId",
                table: "MediaAssets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBanks_TenantId",
                table: "QuestionBanks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_QuestionVersionId_SortOrder",
                table: "QuestionOptions",
                columns: new[] { "QuestionVersionId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_QuestionVersionId_TenantId",
                table: "QuestionOptions",
                columns: new[] { "QuestionVersionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Questions_BankId_TenantId",
                table: "Questions",
                columns: new[] { "BankId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Questions_TenantId_BankId",
                table: "Questions",
                columns: new[] { "TenantId", "BankId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionTagLinks_QuestionId_TenantId",
                table: "QuestionTagLinks",
                columns: new[] { "QuestionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionTagLinks_TagId_TenantId",
                table: "QuestionTagLinks",
                columns: new[] { "TagId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionTags_TenantId_NormalizedName",
                table: "QuestionTags",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVersions_MediaAssetId_TenantId",
                table: "QuestionVersions",
                columns: new[] { "MediaAssetId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVersions_QuestionId_TenantId",
                table: "QuestionVersions",
                columns: new[] { "QuestionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVersions_QuestionId_VersionNumber",
                table: "QuestionVersions",
                columns: new[] { "QuestionId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVersions_TenantId",
                table: "QuestionVersions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionOptions");

            migrationBuilder.DropTable(
                name: "QuestionTagLinks");

            migrationBuilder.DropTable(
                name: "QuestionVersions");

            migrationBuilder.DropTable(
                name: "QuestionTags");

            migrationBuilder.DropTable(
                name: "MediaAssets");

            migrationBuilder.DropTable(
                name: "Questions");

            migrationBuilder.DropTable(
                name: "QuestionBanks");
        }
    }
}
