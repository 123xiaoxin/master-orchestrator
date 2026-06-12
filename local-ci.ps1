<#
.SYNOPSIS
  Run the complete local validation pipeline.
.PARAMETER AgencyRoot
  Expert library root used by template validation.
.PARAMETER OutputReport
  Write local-ci-report.json at the repository root.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$AgencyRoot = "",

    [Parameter(Mandatory = $false)]
    [switch]$OutputReport
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$results = New-Object System.Collections.Generic.List[object]

if ([string]::IsNullOrWhiteSpace($AgencyRoot)) {
    $AgencyRoot = Join-Path $env:USERPROFILE ".openclaw\agency-agents"
}

function Invoke-CiCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $startedAt = [DateTimeOffset]::UtcNow
    try {
        $message = & $Action
        $script:results.Add([ordered]@{
            name = $Name
            ok = $true
            message = [string]$message
            durationMs = [int]([DateTimeOffset]::UtcNow - $startedAt).TotalMilliseconds
        }) | Out-Null
        Write-Host "[PASS] $Name"
    } catch {
        $script:results.Add([ordered]@{
            name = $Name
            ok = $false
            message = $_.Exception.Message
            durationMs = [int]([DateTimeOffset]::UtcNow - $startedAt).TotalMilliseconds
        }) | Out-Null
        Write-Host "[FAIL] $Name - $($_.Exception.Message)"
    }
}

Invoke-CiCheck -Name "encoding" -Action {
    $output = & (Join-Path $repoRoot "scripts\check_encoding.ps1") -Json
    $check = ($output | Select-Object -Last 1) | ConvertFrom-Json
    if (-not $check.ok) {
        throw ($check.issues | ConvertTo-Json -Depth 6 -Compress)
    }
    return "Encoding check passed for $($check.checked) files."
}

Invoke-CiCheck -Name "templates" -Action {
    $output = & (Join-Path $repoRoot "helpers\validate_templates.ps1") -AgencyRoot $AgencyRoot
    $check = ($output | Select-Object -Last 1) | ConvertFrom-Json
    if (-not $check.ok) {
        throw ($check.results | Where-Object { -not $_.ok } | ConvertTo-Json -Depth 8 -Compress)
    }
    return "Validated $($check.total) Agent Pack templates."
}

Invoke-CiCheck -Name "task-analysis" -Action {
    $files = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "examples\task-analysis") -Filter *.json -File)
    if ($files.Count -lt 1) {
        throw "No task_analysis examples found."
    }
    $output = & (Join-Path $repoRoot "helpers\validate_task_analysis.ps1") -File $files.FullName -Json
    $check = ($output | Select-Object -Last 1) | ConvertFrom-Json
    if (-not $check.ok) {
        throw ($check.results | Where-Object { -not $_.ok } | ConvertTo-Json -Depth 8 -Compress)
    }
    return "Validated $($check.total) task_analysis examples."
}

Invoke-CiCheck -Name "intent-elicitation" -Action {
    $validator = Join-Path $repoRoot "helpers\validate_intent_elicitation.ps1"
    $files = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "examples\intent-elicit") -Filter *.json -File)
    if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) {
        throw "Intent elicitation validator is missing."
    }
    if ($files.Count -lt 1) {
        throw "No intent_elicitation examples found."
    }
    $output = & $validator -File $files.FullName -Json
    $check = ($output | Select-Object -Last 1) | ConvertFrom-Json
    if (-not $check.ok) {
        throw ($check.results | Where-Object { -not $_.ok } | ConvertTo-Json -Depth 8 -Compress)
    }
    return "Validated $($check.total) intent_elicitation examples."
}

Invoke-CiCheck -Name "offline-prompt-evals" -Action {
    $output = & (Join-Path $repoRoot "evals\run_prompt_evals.ps1") -Json
    $check = ($output | Select-Object -Last 1) | ConvertFrom-Json
    if (-not $check.ok) {
        throw ($check | ConvertTo-Json -Depth 8 -Compress)
    }
    return "Validated $($check.total) offline prompt eval definitions."
}

Invoke-CiCheck -Name "pester" -Action {
    $testResult = & (Join-Path $repoRoot "run-tests.ps1") -PassThru
    if ($testResult.FailedCount -gt 0) {
        throw "$($testResult.FailedCount) of $($testResult.TotalCount) Pester tests failed."
    }
    return "$($testResult.PassedCount) Pester tests passed."
}

$failed = @($results.ToArray() | Where-Object { -not $_.ok })
$summary = [ordered]@{
    generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    ok = ($failed.Count -eq 0)
    total = $results.Count
    failed = $failed.Count
    results = @($results.ToArray())
}

if ($OutputReport) {
    $reportPath = Join-Path $repoRoot "local-ci-report.json"
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($reportPath, ($summary | ConvertTo-Json -Depth 8), $encoding)
}

Write-Output ($summary | ConvertTo-Json -Depth 8 -Compress)
if ($failed.Count -gt 0) {
    exit 1
}
exit 0
