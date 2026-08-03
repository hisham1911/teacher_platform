using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateQuizBuilderAndPublishing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Quizzes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    NormalizedSlug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentDraftVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CurrentPublishedVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PublicCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SubjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    GradeId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Quizzes", x => x.Id);
                    table.UniqueConstraint("AK_Quizzes_Id_TenantId", x => new { x.Id, x.TenantId });
                });

            migrationBuilder.CreateTable(
                name: "QuizVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TitleSnapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DescriptionSnapshot = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    InstructionsSnapshot = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    PassingPercentage = table.Column<int>(type: "integer", nullable: false),
                    TimeMode = table.Column<int>(type: "integer", nullable: false),
                    TimeLimitSeconds = table.Column<int>(type: "integer", nullable: true),
                    ShuffleQuestions = table.Column<bool>(type: "boolean", nullable: false),
                    ShuffleOptions = table.Column<bool>(type: "boolean", nullable: false),
                    ThemeJson = table.Column<string>(type: "jsonb", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Checksum = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizVersions", x => x.Id);
                    table.UniqueConstraint("AK_QuizVersions_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_QuizVersions_Quizzes_QuizId_TenantId",
                        columns: x => new { x.QuizId, x.TenantId },
                        principalTable: "Quizzes",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "QuizVersionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizVersionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizVersionItems_QuestionVersions_QuestionVersionId_TenantId",
                        columns: x => new { x.QuestionVersionId, x.TenantId },
                        principalTable: "QuestionVersions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_QuizVersionItems_QuizVersions_QuizVersionId_TenantId",
                        columns: x => new { x.QuizVersionId, x.TenantId },
                        principalTable: "QuizVersions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersionItems_QuestionVersionId_TenantId",
                table: "QuizVersionItems",
                columns: new[] { "QuestionVersionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersionItems_QuizVersionId_QuestionVersionId",
                table: "QuizVersionItems",
                columns: new[] { "QuizVersionId", "QuestionVersionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersionItems_QuizVersionId_SortOrder",
                table: "QuizVersionItems",
                columns: new[] { "QuizVersionId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersionItems_QuizVersionId_TenantId",
                table: "QuizVersionItems",
                columns: new[] { "QuizVersionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersionItems_TenantId",
                table: "QuizVersionItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersions_QuizId_TenantId",
                table: "QuizVersions",
                columns: new[] { "QuizId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersions_QuizId_VersionNumber",
                table: "QuizVersions",
                columns: new[] { "QuizId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizVersions_TenantId",
                table: "QuizVersions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_TenantId",
                table: "Quizzes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_TenantId_NormalizedSlug",
                table: "Quizzes",
                columns: new[] { "TenantId", "NormalizedSlug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_TenantId_PublicCode",
                table: "Quizzes",
                columns: new[] { "TenantId", "PublicCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuizVersionItems");

            migrationBuilder.DropTable(
                name: "QuizVersions");

            migrationBuilder.DropTable(
                name: "Quizzes");
        }
    }
}
