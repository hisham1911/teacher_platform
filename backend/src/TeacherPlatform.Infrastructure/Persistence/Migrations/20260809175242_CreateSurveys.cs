using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateSurveys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Surveys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Surveys", x => x.Id);
                    table.UniqueConstraint("AK_Surveys_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Surveys_Quizzes_QuizId_TenantId",
                        columns: x => new { x.QuizId, x.TenantId },
                        principalTable: "Quizzes",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    QuestionType = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestions", x => x.Id);
                    table.UniqueConstraint("AK_SurveyQuestions_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_SurveyQuestions_Surveys_SurveyId_TenantId",
                        columns: x => new { x.SurveyId, x.TenantId },
                        principalTable: "Surveys",
                        principalColumns: new[] { "Id", "TenantId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyResponses", x => x.Id);
                    table.UniqueConstraint("AK_SurveyResponses_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_SurveyResponses_Attempts_AttemptId_TenantId",
                        columns: x => new { x.AttemptId, x.TenantId },
                        principalTable: "Attempts",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_SurveyResponses_Surveys_SurveyId_TenantId",
                        columns: x => new { x.SurveyId, x.TenantId },
                        principalTable: "Surveys",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "SurveyOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    OptionText = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyOptions", x => x.Id);
                    table.UniqueConstraint("AK_SurveyOptions_Id_SurveyQuestionId_TenantId", x => new { x.Id, x.SurveyQuestionId, x.TenantId });
                    table.ForeignKey(
                        name: "FK_SurveyOptions_SurveyQuestions_SurveyQuestionId_TenantId",
                        columns: x => new { x.SurveyQuestionId, x.TenantId },
                        principalTable: "SurveyQuestions",
                        principalColumns: new[] { "Id", "TenantId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyResponseId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingValue = table.Column<int>(type: "integer", nullable: true),
                    SelectedOptionId = table.Column<Guid>(type: "uuid", nullable: true),
                    TextValue = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyAnswers_SurveyOptions_SelectedOptionId_SurveyQuestion~",
                        columns: x => new { x.SelectedOptionId, x.SurveyQuestionId, x.TenantId },
                        principalTable: "SurveyOptions",
                        principalColumns: new[] { "Id", "SurveyQuestionId", "TenantId" });
                    table.ForeignKey(
                        name: "FK_SurveyAnswers_SurveyQuestions_SurveyQuestionId_TenantId",
                        columns: x => new { x.SurveyQuestionId, x.TenantId },
                        principalTable: "SurveyQuestions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_SurveyAnswers_SurveyResponses_SurveyResponseId_TenantId",
                        columns: x => new { x.SurveyResponseId, x.TenantId },
                        principalTable: "SurveyResponses",
                        principalColumns: new[] { "Id", "TenantId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_SelectedOptionId_SurveyQuestionId_TenantId",
                table: "SurveyAnswers",
                columns: new[] { "SelectedOptionId", "SurveyQuestionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_SurveyQuestionId_TenantId",
                table: "SurveyAnswers",
                columns: new[] { "SurveyQuestionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_SurveyResponseId_SurveyQuestionId",
                table: "SurveyAnswers",
                columns: new[] { "SurveyResponseId", "SurveyQuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_SurveyResponseId_TenantId",
                table: "SurveyAnswers",
                columns: new[] { "SurveyResponseId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_TenantId",
                table: "SurveyAnswers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOptions_SurveyQuestionId_SortOrder",
                table: "SurveyOptions",
                columns: new[] { "SurveyQuestionId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOptions_SurveyQuestionId_TenantId",
                table: "SurveyOptions",
                columns: new[] { "SurveyQuestionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOptions_TenantId",
                table: "SurveyOptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyId_SortOrder",
                table: "SurveyQuestions",
                columns: new[] { "SurveyId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyId_TenantId",
                table: "SurveyQuestions",
                columns: new[] { "SurveyId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_TenantId",
                table: "SurveyQuestions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_AttemptId_TenantId",
                table: "SurveyResponses",
                columns: new[] { "AttemptId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId_AttemptId",
                table: "SurveyResponses",
                columns: new[] { "SurveyId", "AttemptId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId_TenantId",
                table: "SurveyResponses",
                columns: new[] { "SurveyId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_TenantId",
                table: "SurveyResponses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_QuizId_TenantId",
                table: "Surveys",
                columns: new[] { "QuizId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_TenantId_QuizId",
                table: "Surveys",
                columns: new[] { "TenantId", "QuizId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_TenantId_Status",
                table: "Surveys",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyAnswers");

            migrationBuilder.DropTable(
                name: "SurveyOptions");

            migrationBuilder.DropTable(
                name: "SurveyResponses");

            migrationBuilder.DropTable(
                name: "SurveyQuestions");

            migrationBuilder.DropTable(
                name: "Surveys");
        }
    }
}
