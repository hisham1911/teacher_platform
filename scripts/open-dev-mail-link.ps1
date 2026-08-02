<#
.SYNOPSIS
    Opens the confirmation link from the most recent dev-mail entry.
.DESCRIPTION
    Reads the latest .dev-mail/*.json file, extracts ActionUrl, and opens it in the default browser.
    Useful for manual testing of the email confirmation flow during Phase 1.
.EXAMPLE
    .\scripts\open-dev-mail-link.ps1
#>

param(
    [string]$Kind = "Confirmation"
)

$dir = Join-Path $PSScriptRoot "..\backend\src\TeacherPlatform.Api\.dev-mail"
if (-not (Test-Path $dir)) {
    Write-Error "No .dev-mail directory found at $dir. Run a registration first."
    exit 1
}

$latest = Get-ChildItem -Path $dir -Filter "*.json" |
    Where-Object {
        $email = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $email.Kind -eq $Kind
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $latest) {
    Write-Error "No $Kind emails found in $dir"
    exit 1
}

$email = Get-Content $latest.FullName -Raw | ConvertFrom-Json
Write-Host "Opening $Kind link for: $($email.To)"
Write-Host "ActionUrl: $($email.ActionUrl)"

# Open in default browser
Start-Process $email.ActionUrl
