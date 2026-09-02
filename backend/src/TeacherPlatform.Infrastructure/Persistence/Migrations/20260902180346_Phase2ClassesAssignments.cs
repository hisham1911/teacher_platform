using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase2ClassesAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccessKind",
                table: "QuizSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvailableAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assignments", x => x.Id);
                    table.UniqueConstraint("AK_Assignments_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Assignments_QuizSessions_SessionId_TenantId",
                        columns: x => new { x.SessionId, x.TenantId },
                        principalTable: "QuizSessions",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_Assignments_QuizVersions_QuizVersionId_TenantId",
                        columns: x => new { x.QuizVersionId, x.TenantId },
                        principalTable: "QuizVersions",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "Classrooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AcademicYear = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Classrooms", x => x.Id);
                    table.UniqueConstraint("AK_Classrooms_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Classrooms_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AssignmentRecipients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceClassroomId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentRecipients", x => x.Id);
                    table.UniqueConstraint("AK_AssignmentRecipients_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_AssignmentRecipients_Assignments_AssignmentId_TenantId",
                        columns: x => new { x.AssignmentId, x.TenantId },
                        principalTable: "Assignments",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_AssignmentRecipients_Classrooms_SourceClassroomId_TenantId",
                        columns: x => new { x.SourceClassroomId, x.TenantId },
                        principalTable: "Classrooms",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_AssignmentRecipients_Students_StudentId_TenantId",
                        columns: x => new { x.StudentId, x.TenantId },
                        principalTable: "Students",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "ClassroomStudents",
                columns: table => new
                {
                    ClassroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassroomStudents", x => new { x.ClassroomId, x.StudentId });
                    table.ForeignKey(
                        name: "FK_ClassroomStudents_Classrooms_ClassroomId_TenantId",
                        columns: x => new { x.ClassroomId, x.TenantId },
                        principalTable: "Classrooms",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_ClassroomStudents_Students_StudentId_TenantId",
                        columns: x => new { x.StudentId, x.TenantId },
                        principalTable: "Students",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_AssignmentId_TenantId",
                table: "AssignmentRecipients",
                columns: new[] { "AssignmentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_SourceClassroomId_TenantId",
                table: "AssignmentRecipients",
                columns: new[] { "SourceClassroomId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_StudentId_TenantId",
                table: "AssignmentRecipients",
                columns: new[] { "StudentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_TenantId_AssignmentId_StudentId",
                table: "AssignmentRecipients",
                columns: new[] { "TenantId", "AssignmentId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_TenantId_SourceClassroomId",
                table: "AssignmentRecipients",
                columns: new[] { "TenantId", "SourceClassroomId" });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRecipients_TenantId_StudentId",
                table: "AssignmentRecipients",
                columns: new[] { "TenantId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_QuizVersionId_TenantId",
                table: "Assignments",
                columns: new[] { "QuizVersionId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_SessionId",
                table: "Assignments",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_SessionId_TenantId",
                table: "Assignments",
                columns: new[] { "SessionId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_TenantId_AvailableAt",
                table: "Assignments",
                columns: new[] { "TenantId", "AvailableAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_TenantId_DueAt",
                table: "Assignments",
                columns: new[] { "TenantId", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_TenantId_QuizVersionId",
                table: "Assignments",
                columns: new[] { "TenantId", "QuizVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Classrooms_TenantId_IsActive",
                table: "Classrooms",
                columns: new[] { "TenantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Classrooms_TenantId_Name",
                table: "Classrooms",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassroomStudents_ClassroomId_TenantId",
                table: "ClassroomStudents",
                columns: new[] { "ClassroomId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassroomStudents_StudentId_TenantId",
                table: "ClassroomStudents",
                columns: new[] { "StudentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassroomStudents_TenantId_ClassroomId",
                table: "ClassroomStudents",
                columns: new[] { "TenantId", "ClassroomId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassroomStudents_TenantId_StudentId",
                table: "ClassroomStudents",
                columns: new[] { "TenantId", "StudentId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssignmentRecipients");

            migrationBuilder.DropTable(
                name: "ClassroomStudents");

            migrationBuilder.DropTable(
                name: "Assignments");

            migrationBuilder.DropTable(
                name: "Classrooms");

            migrationBuilder.DropColumn(
                name: "AccessKind",
                table: "QuizSessions");
        }
    }
}
