using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeacherPlatform.Api.Authorization;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Surveys;
using TeacherPlatform.Infrastructure.Services;

namespace TeacherPlatform.Api.Controllers;

[ApiController]
[Route("api/v1/tenants/{tenantId:guid}/surveys")]
[Produces("application/json")]
[Authorize(Policy = AuthorizationPolicies.ActiveTenantMember)]
public sealed class SurveysController : ControllerBase
{
    private readonly SurveyService _surveyService;

    public SurveysController(SurveyService surveyService)
    {
        _surveyService = surveyService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SurveyListItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid tenantId,
        [FromQuery] Guid? quizId,
        CancellationToken cancellationToken)
    {
        var surveys = await _surveyService.ListAsync(quizId, cancellationToken);
        return Ok(surveys);
    }

    [HttpGet("{surveyId:guid}")]
    [ProducesResponseType(typeof(SurveyDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid surveyId,
        CancellationToken cancellationToken)
    {
        var survey = await _surveyService.GetAsync(surveyId, cancellationToken);
        if (survey is null)
        {
            throw new ServiceResultException("NotFound", "Survey not found.");
        }

        return Ok(survey);
    }

    [HttpGet("{surveyId:guid}/results")]
    [ProducesResponseType(typeof(SurveyResultsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetResults(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid surveyId,
        CancellationToken cancellationToken)
    {
        var results = await _surveyService.GetResultsAsync(surveyId, cancellationToken);
        if (results is null)
        {
            throw new ServiceResultException("NotFound", "Survey not found.");
        }

        return Ok(results);
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SurveyDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromRoute] Guid tenantId,
        [FromBody] CreateSurveyRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, survey) = await _surveyService.CreateAsync(request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return CreatedAtAction(nameof(Get), new { tenantId, surveyId = survey!.Id }, survey);
    }

    [HttpPut("{surveyId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SurveyDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid surveyId,
        [FromBody] UpdateSurveyRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, survey) = await _surveyService.UpdateAsync(surveyId, request, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(survey);
    }

    [HttpPost("{surveyId:guid}/publish")]
    [Authorize(Policy = AuthorizationPolicies.TenantContentManagement)]
    [ProducesResponseType(typeof(SurveyDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Publish(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid surveyId,
        [FromBody] PublishSurveyRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (error, survey) = await _surveyService.PublishAsync(surveyId, request.BaseVersion, cancellationToken);
        if (error is not null)
        {
            throw error;
        }

        return Ok(survey);
    }
}
