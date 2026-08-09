using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Live;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>
/// يصدر JWT قصير العمر خاصًا باتصال SignalR. لا يُخزن في قاعدة البيانات أو Web Storage.
/// </summary>
public sealed class LiveTokenService
{
    private readonly JwtOptions _jwtOptions;
    private readonly SessionOptions _sessionOptions;
    private readonly IClock _clock;

    public LiveTokenService(
        IOptions<JwtOptions> jwtOptions,
        IOptions<SessionOptions> sessionOptions,
        IClock clock)
    {
        _jwtOptions = jwtOptions.Value;
        _sessionOptions = sessionOptions.Value;
        _clock = clock;
    }

    public LiveTokenResponse GenerateTeacher(Guid userId, Guid tenantId, Guid sessionId) =>
        Generate(userId, tenantId, sessionId, null, LiveTokenClaims.Teacher);

    public LiveTokenResponse GeneratePlayer(Guid participantId, Guid tenantId, Guid sessionId) =>
        Generate(participantId, tenantId, sessionId, participantId, LiveTokenClaims.Player);

    private LiveTokenResponse Generate(
        Guid subjectId,
        Guid tenantId,
        Guid sessionId,
        Guid? participantId,
        string liveRole)
    {
        var now = _clock.UtcNow;
        var expiresAt = now.AddMinutes(_sessionOptions.LiveTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subjectId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(LiveTokenClaims.Role, liveRole),
            new(LiveTokenClaims.TenantId, tenantId.ToString()),
            new(LiveTokenClaims.SessionId, sessionId.ToString())
        };
        if (participantId is Guid participant)
        {
            claims.Add(new Claim(LiveTokenClaims.ParticipantId, participant.ToString()));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SigningKey));
        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new LiveTokenResponse
        {
            AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiresAt
        };
    }
}
