using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260828142000_CreateStudentRoster")]
public sealed class CreateStudentRoster : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Students",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                FullName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                StudentCode = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                Grade = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Students", x => x.Id);
                table.UniqueConstraint("AK_Students_Id_TenantId", x => new { x.Id, x.TenantId });
                table.ForeignKey(
                    name: "FK_Students_Tenants_TenantId",
                    column: x => x.TenantId,
                    principalTable: "Tenants",
                    principalColumn: "Id");
            });

        migrationBuilder.CreateTable(
            name: "StudentSessionLinks",
            columns: table => new
            {
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                LinkedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StudentSessionLinks", x => new { x.TenantId, x.StudentId, x.SessionId });
                table.ForeignKey(
                    name: "FK_StudentSessionLinks_Students_StudentId_TenantId",
                    columns: x => new { x.StudentId, x.TenantId },
                    principalTable: "Students",
                    principalColumns: new[] { "Id", "TenantId" });
                table.ForeignKey(
                    name: "FK_StudentSessionLinks_QuizSessions_SessionId_TenantId",
                    columns: x => new { x.SessionId, x.TenantId },
                    principalTable: "QuizSessions",
                    principalColumns: new[] { "Id", "TenantId" });
                table.ForeignKey(
                    name: "FK_StudentSessionLinks_SessionParticipants_ParticipantId_TenantId",
                    columns: x => new { x.ParticipantId, x.TenantId },
                    principalTable: "SessionParticipants",
                    principalColumns: new[] { "Id", "TenantId" });
            });

        migrationBuilder.CreateIndex(
            name: "IX_Students_TenantId_StudentCode",
            table: "Students",
            columns: new[] { "TenantId", "StudentCode" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Students_TenantId_FullName",
            table: "Students",
            columns: new[] { "TenantId", "FullName" });

        migrationBuilder.CreateIndex(
            name: "IX_StudentSessionLinks_ParticipantId_TenantId",
            table: "StudentSessionLinks",
            columns: new[] { "ParticipantId", "TenantId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_StudentSessionLinks_SessionId_TenantId",
            table: "StudentSessionLinks",
            columns: new[] { "SessionId", "TenantId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "StudentSessionLinks");
        migrationBuilder.DropTable(name: "Students");
    }
}
