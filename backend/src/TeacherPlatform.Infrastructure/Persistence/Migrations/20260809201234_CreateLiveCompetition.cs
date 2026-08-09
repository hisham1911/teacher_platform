using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateLiveCompetition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LiveSessionStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Phase = table.Column<int>(type: "integer", nullable: false),
                    CurrentQuestionIndex = table.Column<int>(type: "integer", nullable: false),
                    CurrentQuizVersionItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    QuestionStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    QuestionClosesAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveSessionStates", x => x.Id);
                    table.UniqueConstraint("AK_LiveSessionStates_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_LiveSessionStates_QuizSessions_SessionId_TenantId",
                        columns: x => new { x.SessionId, x.TenantId },
                        principalTable: "QuizSessions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_LiveSessionStates_QuizVersionItems_CurrentQuizVersionItemId~",
                        columns: x => new { x.CurrentQuizVersionItemId, x.TenantId },
                        principalTable: "QuizVersionItems",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_LiveSessionStates_CurrentQuizVersionItemId_TenantId",
                table: "LiveSessionStates",
                columns: new[] { "CurrentQuizVersionItemId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_LiveSessionStates_Phase_QuestionClosesAt",
                table: "LiveSessionStates",
                columns: new[] { "Phase", "QuestionClosesAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LiveSessionStates_SessionId",
                table: "LiveSessionStates",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveSessionStates_SessionId_TenantId",
                table: "LiveSessionStates",
                columns: new[] { "SessionId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveSessionStates_TenantId_Phase",
                table: "LiveSessionStates",
                columns: new[] { "TenantId", "Phase" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LiveSessionStates");
        }
    }
}
