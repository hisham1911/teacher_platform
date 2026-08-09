using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeacherPlatform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateCertificatesAndOutbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CertificateTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TitleText = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BodyText = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IssuerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PrimaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SecondaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CertificateTemplates", x => x.Id);
                    table.UniqueConstraint("AK_CertificateTemplates_Id_TenantId", x => new { x.Id, x.TenantId });
                });

            migrationBuilder.CreateTable(
                name: "OutboxMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    MessageType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AggregateId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    LockedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockOwner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboxMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParentResultShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParentResultShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParentResultShares_Attempts_AttemptId_TenantId",
                        columns: x => new { x.AttemptId, x.TenantId },
                        principalTable: "Attempts",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateTable(
                name: "Certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CertificateNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PublicTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PublicTokenProtected = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    QuizTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Percentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    TitleText = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BodyText = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IssuerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PrimaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SecondaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    FileObjectKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Certificates", x => x.Id);
                    table.UniqueConstraint("AK_Certificates_Id_TenantId", x => new { x.Id, x.TenantId });
                    table.ForeignKey(
                        name: "FK_Certificates_Attempts_AttemptId_TenantId",
                        columns: x => new { x.AttemptId, x.TenantId },
                        principalTable: "Attempts",
                        principalColumns: new[] { "Id", "TenantId" });
                    table.ForeignKey(
                        name: "FK_Certificates_CertificateTemplates_TemplateId_TenantId",
                        columns: x => new { x.TemplateId, x.TenantId },
                        principalTable: "CertificateTemplates",
                        principalColumns: new[] { "Id", "TenantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_AttemptId_TenantId",
                table: "Certificates",
                columns: new[] { "AttemptId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_PublicTokenHash",
                table: "Certificates",
                column: "PublicTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TemplateId_TenantId",
                table: "Certificates",
                columns: new[] { "TemplateId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TenantId_CertificateNumber",
                table: "Certificates",
                columns: new[] { "TenantId", "CertificateNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TenantId_Status",
                table: "Certificates",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CertificateTemplates_TenantId",
                table: "CertificateTemplates",
                column: "TenantId",
                unique: true,
                filter: "\"IsDefault\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_CertificateTemplates_TenantId_Name",
                table: "CertificateTemplates",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_LockedUntil_NextAttemptAt",
                table: "OutboxMessages",
                columns: new[] { "LockedUntil", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_ProcessedAt_NextAttemptAt",
                table: "OutboxMessages",
                columns: new[] { "ProcessedAt", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_TenantId_MessageType",
                table: "OutboxMessages",
                columns: new[] { "TenantId", "MessageType" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_TenantId_MessageType_AggregateId",
                table: "OutboxMessages",
                columns: new[] { "TenantId", "MessageType", "AggregateId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParentResultShares_AttemptId_TenantId",
                table: "ParentResultShares",
                columns: new[] { "AttemptId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParentResultShares_ExpiresAt",
                table: "ParentResultShares",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ParentResultShares_TokenHash",
                table: "ParentResultShares",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Certificates");

            migrationBuilder.DropTable(
                name: "OutboxMessages");

            migrationBuilder.DropTable(
                name: "ParentResultShares");

            migrationBuilder.DropTable(
                name: "CertificateTemplates");
        }
    }
}
