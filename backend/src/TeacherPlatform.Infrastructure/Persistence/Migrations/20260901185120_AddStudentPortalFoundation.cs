using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentPortalFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudentPortalCredentials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    LookupDigest = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VerifierHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    CodeSuffix = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentPortalCredentials", x => x.Id);
                    table.UniqueConstraint("AK_StudentPortalCredentials_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_StudentPortalCredentials_Students_StudentId_TenantId",
                        columns: x => new { x.StudentId, x.TenantId },
                        principalTable: "Students",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "StudentPortalSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CredentialId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentPortalSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentPortalSessions_StudentPortalCredentials_CredentialId~",
                        columns: x => new { x.CredentialId, x.TenantId },
                        principalTable: "StudentPortalCredentials",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_StudentPortalSessions_Students_StudentId_TenantId",
                        columns: x => new { x.StudentId, x.TenantId },
                        principalTable: "Students",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalCredentials_LookupDigest",
                table: "StudentPortalCredentials",
                column: "LookupDigest",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalCredentials_StudentId_TenantId",
                table: "StudentPortalCredentials",
                columns: new[] { "StudentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalCredentials_TenantId_StudentId",
                table: "StudentPortalCredentials",
                columns: new[] { "TenantId", "StudentId" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalSessions_CredentialId_TenantId",
                table: "StudentPortalSessions",
                columns: new[] { "CredentialId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalSessions_ExpiresAt",
                table: "StudentPortalSessions",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalSessions_StudentId_TenantId",
                table: "StudentPortalSessions",
                columns: new[] { "StudentId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalSessions_TenantId_StudentId_RevokedAt",
                table: "StudentPortalSessions",
                columns: new[] { "TenantId", "StudentId", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPortalSessions_TokenHash",
                table: "StudentPortalSessions",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentPortalSessions");

            migrationBuilder.DropTable(
                name: "StudentPortalCredentials");
        }
    }
}
