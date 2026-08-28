using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Students;
using TeacherPlatform.Application.Tenancy;
using TeacherPlatform.Infrastructure.Persistence;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// Student roster is intentionally separate from session JoinCode.
/// A StudentCode identifies one managed student inside a tenant; JoinCode identifies one activity session.
/// The roster uses explicit tenant predicates on every query, including anonymous player resolution.
/// </summary>
public sealed class StudentService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IClock _clock;

    public StudentService(AppDbContext db, ITenantContext tenantContext, IClock clock)
    {
        _db = db;
        _tenantContext = tenantContext;
        _clock = clock;
    }

    public async Task<IReadOnlyList<StudentResponse>> ListAsync(
        string? search,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        return await WithConnectionAsync(async connection =>
        {
            const string sql = """
                SELECT "Id", "FullName", "StudentCode", "Grade", "Notes", "IsActive", "CreatedAt", "UpdatedAt"
                FROM "Students"
                WHERE "TenantId" = @tenantId
                  AND (@includeInactive OR "IsActive" = TRUE)
                  AND (@search IS NULL OR "FullName" ILIKE '%' || @search || '%' OR "StudentCode" ILIKE '%' || @search || '%')
                ORDER BY "IsActive" DESC, "FullName" ASC, "CreatedAt" ASC;
                """;
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("includeInactive", includeInactive);
            command.Parameters.AddWithValue("search", (object?)normalizedSearch ?? DBNull.Value);
            var students = new List<StudentResponse>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                students.Add(ReadStudent(reader));
            }
            return (IReadOnlyList<StudentResponse>)students;
        }, cancellationToken);
    }

    public async Task<StudentResponse> CreateAsync(CreateStudentRequest request, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var fullName = request.FullName.Trim();
        var grade = NormalizeOptional(request.Grade);
        var notes = NormalizeOptional(request.Notes);
        var now = _clock.UtcNow;

        for (var attempt = 0; attempt < 8; attempt += 1)
        {
            var code = GuestTokenService.GenerateJoinCode(8);
            try
            {
                return await WithConnectionAsync(async connection =>
                {
                    const string sql = """
                        INSERT INTO "Students" ("Id", "TenantId", "FullName", "StudentCode", "Grade", "Notes", "IsActive", "CreatedAt", "UpdatedAt")
                        VALUES (@id, @tenantId, @fullName, @studentCode, @grade, @notes, TRUE, @now, @now)
                        RETURNING "Id", "FullName", "StudentCode", "Grade", "Notes", "IsActive", "CreatedAt", "UpdatedAt";
                        """;
                    await using var command = new NpgsqlCommand(sql, connection);
                    command.Parameters.AddWithValue("id", Guid.NewGuid());
                    command.Parameters.AddWithValue("tenantId", tenantId);
                    command.Parameters.AddWithValue("fullName", fullName);
                    command.Parameters.AddWithValue("studentCode", code);
                    command.Parameters.AddWithValue("grade", (object?)grade ?? DBNull.Value);
                    command.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
                    command.Parameters.AddWithValue("now", now);
                    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                    if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Student insert returned no row.");
                    return ReadStudent(reader);
                }, cancellationToken);
            }
            catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                // Extremely unlikely StudentCode collision; retry with fresh cryptographic code.
            }
        }

        throw new ServiceResultException("Conflict", "Could not allocate a unique student code. Try again.");
    }

    public async Task<StudentResponse?> SetActiveAsync(Guid studentId, bool isActive, CancellationToken cancellationToken)
    {
        var tenantId = RequireTenant();
        var now = _clock.UtcNow;
        return await WithConnectionAsync(async connection =>
        {
            const string sql = """
                UPDATE "Students"
                SET "IsActive" = @isActive, "UpdatedAt" = @now
                WHERE "Id" = @studentId AND "TenantId" = @tenantId
                RETURNING "Id", "FullName", "StudentCode", "Grade", "Notes", "IsActive", "CreatedAt", "UpdatedAt";
                """;
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("isActive", isActive);
            command.Parameters.AddWithValue("now", now);
            command.Parameters.AddWithValue("studentId", studentId);
            command.Parameters.AddWithValue("tenantId", tenantId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? ReadStudent(reader) : null;
        }, cancellationToken);
    }

    public async Task<StudentIdentity?> ResolveActiveByCodeAsync(
        Guid tenantId,
        string studentCode,
        CancellationToken cancellationToken)
    {
        var normalizedCode = NormalizeCode(studentCode);
        if (normalizedCode.Length < 4) return null;
        return await WithConnectionAsync(async connection =>
        {
            const string sql = """
                SELECT "Id", "TenantId", "FullName", "StudentCode"
                FROM "Students"
                WHERE "TenantId" = @tenantId AND "StudentCode" = @studentCode AND "IsActive" = TRUE
                LIMIT 1;
                """;
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("studentCode", normalizedCode);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;
            return new StudentIdentity(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3));
        }, cancellationToken);
    }

    public async Task<Guid?> GetLinkedParticipantIdAsync(
        Guid tenantId,
        Guid sessionId,
        Guid studentId,
        CancellationToken cancellationToken)
    {
        return await WithConnectionAsync(async connection =>
        {
            const string sql = """
                SELECT "ParticipantId"
                FROM "StudentSessionLinks"
                WHERE "TenantId" = @tenantId AND "SessionId" = @sessionId AND "StudentId" = @studentId
                LIMIT 1;
                """;
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("sessionId", sessionId);
            command.Parameters.AddWithValue("studentId", studentId);
            var value = await command.ExecuteScalarAsync(cancellationToken);
            return value is Guid participantId ? participantId : null;
        }, cancellationToken);
    }

    public async Task LinkParticipantAsync(
        Guid tenantId,
        Guid studentId,
        Guid sessionId,
        Guid participantId,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        await WithConnectionAsync(async connection =>
        {
            const string sql = """
                INSERT INTO "StudentSessionLinks" ("TenantId", "StudentId", "SessionId", "ParticipantId", "LinkedAt")
                VALUES (@tenantId, @studentId, @sessionId, @participantId, @linkedAt)
                ON CONFLICT ("TenantId", "StudentId", "SessionId") DO NOTHING;
                """;
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("tenantId", tenantId);
            command.Parameters.AddWithValue("studentId", studentId);
            command.Parameters.AddWithValue("sessionId", sessionId);
            command.Parameters.AddWithValue("participantId", participantId);
            command.Parameters.AddWithValue("linkedAt", now);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private Guid RequireTenant() => _tenantContext.TenantId is { } tenantId && tenantId != Guid.Empty
        ? tenantId
        : throw new ServiceResultException("TenantContextMissing", "Active tenant context is required.");

    private async Task<T> WithConnectionAsync<T>(Func<NpgsqlConnection, Task<T>> action, CancellationToken cancellationToken)
    {
        var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose) await connection.OpenAsync(cancellationToken);
        try
        {
            return await action(connection);
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }

    private static StudentResponse ReadStudent(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetGuid(0),
        FullName = reader.GetString(1),
        StudentCode = reader.GetString(2),
        Grade = reader.IsDBNull(3) ? null : reader.GetString(3),
        Notes = reader.IsDBNull(4) ? null : reader.GetString(4),
        IsActive = reader.GetBoolean(5),
        CreatedAt = reader.GetDateTime(6),
        UpdatedAt = reader.GetDateTime(7)
    };

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string NormalizeCode(string value) => new(value.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
}
