<#
.SYNOPSIS
  Validate offline prompt eval case definitions.
.DESCRIPTION
  v5.4 intentionally does not call a real LLM. This runner checks that offline
  eval case files define the prompt-governance constraints that future eval
  tooling can execute.
.PARAMETER CasesDir
  Directory containing eval case JSON files.
.PARAMETER Json
  Emit a machine-readable JSON result.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$CasesDir = "",

    [Parameter(Mandatory = $false)]
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Has-Property {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Add-Issue {
    param(
        [System.Collections.Generic.List[string]]$Issues,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $Issues.Add($Message) | Out-Null
}

try {
    if ([string]::IsNullOrWhiteSpace($CasesDir)) {
        $CasesDir = Join-Path $PSScriptRoot "cases"
    }
    $resolvedCasesDir = (Resolve-Path -LiteralPath $CasesDir).Path
    $files = @(Get-ChildItem -LiteralPath $resolvedCasesDir -Filter *.json -File | Sort-Object Name)
    $results = New-Object System.Collections.Generic.List[object]

    foreach ($file in $files) {
        $issues = New-Object System.Collections.Generic.List[string]
        try {
            $case = Get-Content -Raw -Encoding UTF8 -LiteralPath $file.FullName | ConvertFrom-Json
            foreach ($field in @("id", "input", "expectedBehavior", "mustContain", "mustNotContain")) {
                if (-not (Has-Property -Object $case -Name $field)) {
                    Add-Issue -Issues $issues -Message "$field must be present."
                }
            }
            foreach ($field in @("id", "input", "expectedBehavior")) {
                if ((Has-Property -Object $case -Name $field) -and [string]::IsNullOrWhiteSpace([string]$case.$field)) {
                    Add-Issue -Issues $issues -Message "$field must be non-empty."
                }
            }
            if ((Has-Property -Object $case -Name "mustContain") -and @($case.mustContain).Count -lt 1) {
                Add-Issue -Issues $issues -Message "mustContain must contain at least one assertion."
            }
        } catch {
            Add-Issue -Issues $issues -Message "Invalid JSON: $($_.Exception.Message)"
        }

        $results.Add([ordered]@{
            file = $file.Name
            ok = ($issues.Count -eq 0)
            issues = @($issues.ToArray())
        }) | Out-Null
    }

    $failed = @($results.ToArray() | Where-Object { -not $_.ok })
    $coverage = [ordered]@{
        hasAmbiguousClarification = [bool](@($files | Where-Object { $_.BaseName -match "ambiguous" }).Count -gt 0)
        hasHeartbeatGuardrail = [bool](@($files | Where-Object { $_.BaseName -match "heartbeat" }).Count -gt 0)
        hasUserAgentBypass = [bool](@($files | Where-Object { $_.BaseName -match "user-agent" }).Count -gt 0)
    }

    $coverageIssues = New-Object System.Collections.Generic.List[string]
    if ($files.Count -lt 3) {
        Add-Issue -Issues $coverageIssues -Message "At least 3 eval cases are required."
    }
    if (-not $coverage.hasAmbiguousClarification) {
        Add-Issue -Issues $coverageIssues -Message "Missing ambiguous input clarification case."
    }
    if (-not $coverage.hasHeartbeatGuardrail) {
        Add-Issue -Issues $coverageIssues -Message "Missing heartbeat guardrail case."
    }
    if (-not $coverage.hasUserAgentBypass) {
        Add-Issue -Issues $coverageIssues -Message "Missing user-created agent bypass case."
    }

    $ok = ($failed.Count -eq 0 -and $coverageIssues.Count -eq 0)
    $summary = [ordered]@{
        ok = $ok
        total = $files.Count
        failed = $failed.Count
        coverage = $coverage
        coverageIssues = @($coverageIssues.ToArray())
        results = @($results.ToArray())
    }

    if ($Json) {
        Write-Output ($summary | ConvertTo-Json -Depth 8 -Compress)
    } else {
        if ($ok) {
            Write-Output "OK offline prompt eval cases: $($files.Count)"
        } else {
            foreach ($issue in $coverageIssues) {
                Write-Output "FAIL coverage: $issue"
            }
            foreach ($result in $results) {
                if (-not $result.ok) {
                    Write-Output "FAIL $($result.file)"
                    foreach ($issue in $result.issues) {
                        Write-Output "  - $issue"
                    }
                }
            }
        }
    }

    if (-not $ok) {
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
