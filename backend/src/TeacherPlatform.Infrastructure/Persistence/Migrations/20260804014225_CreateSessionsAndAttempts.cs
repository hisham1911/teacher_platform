using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateSessionsAndAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_QuizVersionItems_Id_TenantId",
                table: "QuizVersionItems",
                columns: new[] { "Id", "TenantId" });

            migrationBuilder.CreateTable(
                name: "QuizSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    JoinCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Mode = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizSessions", x => x.Id);
                    table.UniqueConstraint("AK_QuizSessions_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_QuizSessions_QuizVersions_QuizVersionId_TenantId",
                        columns: x => new { x.QuizVersionId, x.TenantId },
                        principalTable: "QuizVersions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_QuizSessions_Quizzes_QuizId_TenantId",
                        columns: x => new { x.QuizId, x.TenantId },
                        principalTable: "Quizzes",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "SessionParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GuestTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    GuestTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionParticipants", x => x.Id);
                    table.UniqueConstraint("AK_SessionParticipants_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_SessionParticipants_QuizSessions_SessionId_TenantId",
                        columns: x => new { x.SessionId, x.TenantId },
                        principalTable: "QuizSessions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "Attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShuffleSeed = table.Column<int>(type: "integer", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentQuestionIndex = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeadlineAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: true),
                    Score = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    MaxScore = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    Percentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Passed = table.Column<bool>(type: "boolean", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attempts", x => x.Id);
                    table.UniqueConstraint("AK_Attempts_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Attempts_QuizSessions_SessionId_TenantId",
                        columns: x => new { x.SessionId, x.TenantId },
                        principalTable: "QuizSessions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_Attempts_SessionParticipants_ParticipantId_TenantId",
                        columns: x => new { x.ParticipantId, x.TenantId },
                        principalTable: "SessionParticipants",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "AttemptAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizVersionItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnswerJson = table.Column<string>(type: "jsonb", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: true),
                    ScoreAwarded = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    AnsweredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttemptAnswers", x => x.Id);
                    table.UniqueConstraint("AK_AttemptAnswers_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_AttemptAnswers_Attempts_AttemptId_TenantId",
                        columns: x => new { x.AttemptId, x.TenantId },
                        principalTable: "Attempts",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_AttemptAnswers_QuizVersionItems_QuizVersionItemId_TenantId",
                        columns: x => new { x.QuizVersionItemId, x.TenantId },
                        principalTable: "QuizVersionItems",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_AttemptId_QuizVersionItemId",
                table: "AttemptAnswers",
                columns: new[] { "AttemptId", "QuizVersionItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_AttemptId_TenantId",
                table: "AttemptAnswers",
                columns: new[] { "AttemptId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_QuizVersionItemId_TenantId",
                table: "AttemptAnswers",
                columns: new[] { "QuizVersionItemId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_TenantId",
                table: "AttemptAnswers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_ParticipantId_TenantId",
                table: "Attempts",
                columns: new[] { "ParticipantId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_SessionId_ParticipantId",
                table: "Attempts",
                columns: new[] { "SessionId", "ParticipantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_SessionId_TenantId",
                table: "Attempts",
                columns: new[] { "SessionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_TenantId",
                table: "Attempts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_JoinCode",
                table: "QuizSessions",
                column: "JoinCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_QuizId_TenantId",
                table: "QuizSessions",
                columns: new[] { "QuizId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_QuizVersionId_TenantId",
                table: "QuizSessions",
                columns: new[] { "QuizVersionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_TenantId",
                table: "QuizSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_TenantId_QuizId",
                table: "QuizSessions",
                columns: new[] { "TenantId", "QuizId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_TenantId_Status",
                table: "QuizSessions",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SessionParticipants_GuestTokenHash",
                table: "SessionParticipants",
                column: "GuestTokenHash");

            migrationBuilder.CreateIndex(
                name: "IX_SessionParticipants_SessionId_TenantId",
                table: "SessionParticipants",
                columns: new[] { "SessionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SessionParticipants_TenantId",
                table: "SessionParticipants",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttemptAnswers");

            migrationBuilder.DropTable(
                name: "Attempts");

            migrationBuilder.DropTable(
                name: "SessionParticipants");

            migrationBuilder.DropTable(
                name: "QuizSessions");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_QuizVersionItems_Id_TenantId",
                table: "QuizVersionItems");
        }
    }
}
