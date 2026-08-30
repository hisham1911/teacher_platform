using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityLaunchIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LaunchRequestId",
                table: "QuizSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizSessions_TenantId_LaunchRequestId",
                table: "QuizSessions",
                columns: new[] { "TenantId", "LaunchRequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuizSessions_TenantId_LaunchRequestId",
                table: "QuizSessions");

            migrationBuilder.DropColumn(
                name: "LaunchRequestId",
                table: "QuizSessions");
        }
    }
}
