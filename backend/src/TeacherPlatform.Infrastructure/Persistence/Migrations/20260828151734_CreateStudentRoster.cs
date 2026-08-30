using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateStudentRoster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StudentId",
                table: "SessionParticipants",
                type: "uuid",
                nullable: true);

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
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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

            migrationBuilder.CreateIndex(
                name: "IX_SessionParticipants_StudentId_TenantId",
                table: "SessionParticipants",
                columns: new[] { "StudentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_SessionParticipants_TenantId_SessionId_StudentId",
                table: "SessionParticipants",
                columns: new[] { "TenantId", "SessionId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Students_TenantId_FullName",
                table: "Students",
                columns: new[] { "TenantId", "FullName" });

            migrationBuilder.CreateIndex(
                name: "IX_Students_TenantId_IsActive",
                table: "Students",
                columns: new[] { "TenantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Students_TenantId_StudentCode",
                table: "Students",
                columns: new[] { "TenantId", "StudentCode" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SessionParticipants_Students_StudentId_TenantId",
                table: "SessionParticipants",
                columns: new[] { "StudentId", "TenantId" },
                principalTable: "Students",
                principalColumns: new[] { "Id", "TenantId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SessionParticipants_Students_StudentId_TenantId",
                table: "SessionParticipants");

            migrationBuilder.DropTable(
                name: "Students");

            migrationBuilder.DropIndex(
                name: "IX_SessionParticipants_StudentId_TenantId",
                table: "SessionParticipants");

            migrationBuilder.DropIndex(
                name: "IX_SessionParticipants_TenantId_SessionId_StudentId",
                table: "SessionParticipants");

            migrationBuilder.DropColumn(
                name: "StudentId",
                table: "SessionParticipants");
        }
    }
}
