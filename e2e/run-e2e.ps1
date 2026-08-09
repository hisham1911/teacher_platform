param(
    [string]$Stage = "all"
)

# تشغيل E2E كامل من سطر واحد: API (بيئة E2E) + Web + seed + Part A + إعادة تشغيل API + Part B.
# المتطلبات: PostgreSQL محلية، قاعدة teacher_platform_e2e مُنشأة ومهاجرة، و dotnet + node متاحان.
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $repoRoot "backend\src\TeacherPlatform.Api"
$webDir = Join-Path $repoRoot "apps\web"
$e2eDir = $PSScriptRoot
$apiOut = Join-Path $env:TEMP "opencode\e2e\api-e2e.log"
$webOut = Join-Path $env:TEMP "opencode\e2e\web-e2e.log"

function Start-Api {
    Get-Process dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $env:ASPNETCORE_ENVIRONMENT = "E2E"
    Start-Process dotnet -ArgumentList "run", "--project", (Join-Path $apiDir "TeacherPlatform.Api.csproj"), "--no-launch-profile", "--urls", "http://localhost:5000" -WorkingDirectory $apiDir -RedirectStandardOutput $apiOut -RedirectStandardError "$apiOut.err"
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 2
        try { Invoke-WebRequest -Uri "http://localhost:5000/health/ready" -TimeoutSec 3 -UseBasicParsing | Out-Null; Write-Output "API READY"; return } catch { }
    }
    Write-Output "API FAILED to start"
    Get-Content "$apiOut.err" -Tail 15 -ErrorAction SilentlyContinue
    exit 1
}

function Start-Web {
    Start-Process cmd.exe -ArgumentList "/c", "npm run dev -- --host localhost --port 5173 > `"$webOut`" 2>&1" -WorkingDirectory $webDir -WindowStyle Hidden
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 2
        try { Invoke-WebRequest -Uri "http://localhost:5173/" -TimeoutSec 3 -UseBasicParsing | Out-Null; Write-Output "WEB ready"; return } catch { }
    }
    Write-Output "WEB DOWN"
    exit 1
}

function Stop-All {
    Get-Process dotnet, node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

if ($Stage -eq "all" -or $Stage -eq "api") { Start-Api }
if ($Stage -eq "all" -or $Stage -eq "web") { Start-Web }
if ($Stage -eq "all") {
    Push-Location $e2eDir
    npm install
    node seed.mjs
    if ($?) {
        npx playwright test tests/part-a.spec.mjs --reporter=line
        if ($?) {
            Write-Output "---- RESTARTING API (Part B scenario) ----"
            Get-Process dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Api
            npx playwright test tests/part-b.spec.mjs --reporter=line
        }
    }
    Pop-Location
    Stop-All
}