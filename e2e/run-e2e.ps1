param(
    [string]$Stage = "all",
    [int]$ApiPort = 5000,
    [int]$WebPort = 5173
)

# تشغيل E2E كامل من سطر واحد: API + Web + seed + الاستعادة بعد restart + المسابقة المباشرة.
# المتطلبات: PostgreSQL محلية، قاعدة teacher_platform_e2e مُنشأة ومهاجرة، و dotnet + node متاحان.
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $repoRoot "backend\src\TeacherPlatform.Api"
$webDir = Join-Path $repoRoot "apps\web"
$e2eDir = $PSScriptRoot
$apiUrl = "http://localhost:$ApiPort"
$webUrl = "http://localhost:$WebPort"
$logDir = Join-Path ([System.IO.Path]::GetTempPath()) "teacher-platform-e2e"
[System.IO.Directory]::CreateDirectory($logDir) | Out-Null
$apiOut = Join-Path $logDir "api-$ApiPort.log"
$webOut = Join-Path $logDir "web-$WebPort.log"
$script:apiProcess = $null
$script:webProcess = $null

$env:API_URL = $apiUrl
$env:WEB_URL = $webUrl
$env:VITE_API_BASE_URL = $apiUrl
$env:Auth__WebBaseUrl = $webUrl
$env:Auth__TrustedOrigins__0 = $webUrl
$env:Cors__AllowedOrigins__0 = $webUrl

function Start-Api {
    $env:ASPNETCORE_ENVIRONMENT = "E2E"
    $script:apiProcess = Start-Process dotnet -ArgumentList "run", "--project", (Join-Path $apiDir "TeacherPlatform.Api.csproj"), "--no-launch-profile", "--urls", $apiUrl -WorkingDirectory $apiDir -RedirectStandardOutput $apiOut -RedirectStandardError "$apiOut.err" -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 2
        if ($script:apiProcess.HasExited) { break }
        try { Invoke-WebRequest -Uri "$apiUrl/health/ready" -TimeoutSec 3 -UseBasicParsing | Out-Null; Write-Output "API READY at $apiUrl"; return } catch { }
    }
    Write-Output "API FAILED to start"
    Get-Content "$apiOut.err" -Tail 15 -ErrorAction SilentlyContinue
    throw "API failed to start at $apiUrl."
}

function Start-Web {
    $script:webProcess = Start-Process cmd.exe -ArgumentList "/c", "npm run dev -- --host localhost --port $WebPort --strictPort > `"$webOut`" 2>&1" -WorkingDirectory $webDir -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 2
        if ($script:webProcess.HasExited) { break }
        try { Invoke-WebRequest -Uri "$webUrl/" -TimeoutSec 3 -UseBasicParsing | Out-Null; Write-Output "WEB ready at $webUrl"; return } catch { }
    }
    Write-Output "WEB DOWN"
    throw "Web failed to start at $webUrl."
}

function Stop-All {
    foreach ($process in @($script:apiProcess, $script:webProcess)) {
        if ($null -ne $process) {
            Stop-ProcessTree -ProcessId $process.Id
        }
    }
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

if ($Stage -eq "all") {
    $locationPushed = $false
    try {
        npm ci --prefix $webDir
        if ($LASTEXITCODE -ne 0) { throw "Web npm ci failed with exit code $LASTEXITCODE" }
        npm ci --prefix $e2eDir
        if ($LASTEXITCODE -ne 0) { throw "E2E npm ci failed with exit code $LASTEXITCODE" }
        Start-Api
        Start-Web
        Push-Location $e2eDir
        $locationPushed = $true
        node seed.mjs
        if ($LASTEXITCODE -ne 0) { throw "E2E seed failed with exit code $LASTEXITCODE" }
        npx playwright test tests/part-d-builder.spec.mjs --reporter=line
        if ($LASTEXITCODE -ne 0) { throw "Playwright Part D builder failed with exit code $LASTEXITCODE" }
        npx playwright test tests/part-a.spec.mjs --reporter=line
        if ($LASTEXITCODE -ne 0) { throw "Playwright Part A failed with exit code $LASTEXITCODE" }

        Write-Output "---- RESTARTING API (Part B scenario) ----"
        if ($null -ne $script:apiProcess) {
            Stop-ProcessTree -ProcessId $script:apiProcess.Id
        }
        Start-Api
        npx playwright test tests/part-b.spec.mjs --reporter=line
        if ($LASTEXITCODE -ne 0) { throw "Playwright Part B failed with exit code $LASTEXITCODE" }
        npx playwright test tests/part-c-live.spec.mjs --reporter=line
        if ($LASTEXITCODE -ne 0) { throw "Playwright Part C failed with exit code $LASTEXITCODE" }
    }
    finally {
        if ($locationPushed) { Pop-Location }
        Stop-All
    }
}
elseif ($Stage -eq "api") {
    Start-Api
}
elseif ($Stage -eq "web") {
    Start-Web
}
elseif ($Stage -eq "live") {
    $locationPushed = $false
    try {
        Start-Api
        Start-Web
        Push-Location $e2eDir
        $locationPushed = $true
        npx playwright test tests/part-c-live.spec.mjs --reporter=line
        if ($LASTEXITCODE -ne 0) { throw "Playwright Part C failed with exit code $LASTEXITCODE" }
    }
    finally {
        if ($locationPushed) { Pop-Location }
        Stop-All
    }
}
else {
    throw "Stage must be all, api, web, or live."
}
