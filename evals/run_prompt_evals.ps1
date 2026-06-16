<#
.SYNOPSIS
  Validate offline prompt eval case definitions.
.DESCRIPTION
  v5.4+ intentionally does not call a real LLM. This runner checks that offline
  eval case files define the prompt-governance constraints that future eval
  tooling can execute.

  Supports two eval case formats:
  - v1 (legacy): id, input, expectedBehavior (string), mustContain, mustNotContain, evalType
  - v2 (structured): id, version, description, triggerCondition, expectedBehavior (array),
    forbiddenBehavior (array), coverage
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

function Test-LegacyCase {
    param(
        [Parameter(Mandatory = $true)]$Case,
        [Parameter(Mandatory = $true)][string]$FileName,
        [System.Collections.Generic.List[string]]$Issues
    )

    foreach ($field in @("id", "input", "expectedBehavior", "mustContain", "mustNotContain")) {
        if (-not (Has-Property -Object $Case -Name $field)) {
            Add-Issue -Issues $Issues -Message "$field must be present."
        }
    }
    foreach ($field in @("id", "input", "expectedBehavior")) {
        if ((Has-Property -Object $Case -Name $field) -and [string]::IsNullOrWhiteSpace([string]$Case.$field)) {
            Add-Issue -Issues $Issues -Message "$field must be non-empty."
        }
    }
    if ((Has-Property -Object $Case -Name "mustContain") -and @($Case.mustContain).Count -lt 1) {
        Add-Issue -Issues $Issues -Message "mustContain must contain at least one assertion."
    }
}

function Test-StructuredCase {
    param(
        [Parameter(Mandatory = $true)]$Case,
        [Parameter(Mandatory = $true)][string]$FileName,
        [System.Collections.Generic.List[string]]$Issues
    )

    foreach ($field in @("id", "description", "triggerCondition", "expectedBehavior")) {
        if (-not (Has-Property -Object $Case -Name $field)) {
            Add-Issue -Issues $Issues -Message "$field must be present."
        }
    }
    foreach ($field in @("id", "description", "triggerCondition")) {
        if ((Has-Property -Object $Case -Name $field) -and [string]::IsNullOrWhiteSpace([string]$Case.$field)) {
            Add-Issue -Issues $Issues -Message "$field must be non-empty."
        }
    }
    if ((Has-Property -Object $Case -Name "expectedBehavior")) {
        $eb = @($Case.expectedBehavior)
        if ($eb.Count -lt 1) {
            Add-Issue -Issues $Issues -Message "expectedBehavior must contain at least one item."
        }
        foreach ($item in $eb) {
            if ([string]::IsNullOrWhiteSpace([string]$item)) {
                Add-Issue -Issues $Issues -Message "expectedBehavior contains an empty item."
            }
        }
    }
    if ((Has-Property -Object $Case -Name "forbiddenBehavior")) {
        foreach ($item in @($Case.forbiddenBehavior)) {
            if ([string]::IsNullOrWhiteSpace([string]$item)) {
                Add-Issue -Issues $Issues -Message "forbiddenBehavior contains an empty item."
            }
        }
    }
    if (-not (Has-Property -Object $Case -Name "coverage") -or [string]::IsNullOrWhiteSpace([string]$Case.coverage)) {
        Add-Issue -Issues $Issues -Message "coverage must be a non-empty string."
    }
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

            $isStructured = (Has-Property -Object $case -Name "triggerCondition") -or (Has-Property -Object $case -Name "coverage")
            if ($isStructured) {
                Test-StructuredCase -Case $case -FileName $file.Name -Issues $issues
            } else {
                Test-LegacyCase -Case $case -FileName $file.Name -Issues $issues
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
        hasIntentElicitation = [bool](@($files | Where-Object { $_.BaseName -match "^elicit-" }).Count -ge 4)
        hasVerifyRepairLoop = [bool](@($files | Where-Object { $_.BaseName -match "verify-repair" }).Count -gt 0)
        hasRepositoryReadonly = [bool](@($files | Where-Object { $_.BaseName -match "repository-readonly" }).Count -gt 0)
        hasConservativeEdit = [bool](@($files | Where-Object { $_.BaseName -match "conservative-edit" }).Count -gt 0)
        hasExecutionContractRequired = [bool](@($files | Where-Object { $_.BaseName -match "execution-contract" }).Count -gt 0)
        hasClarityGatePrototype = [bool](@($files | Where-Object { $_.BaseName -match "clarity-gate" }).Count -gt 0)
        hasCapabilityGapRouting = [bool](@($files | Where-Object { $_.BaseName -match "capability-gap" }).Count -gt 0)
        hasFiveLayerSnapshot = [bool](@($files | Where-Object { $_.BaseName -match "five-layer" }).Count -gt 0)
        hasGoalPursuitLedger = [bool](@($files | Where-Object { $_.BaseName -match "goal-pursuit" }).Count -gt 0)
        hasFinalReportGate = [bool](@($files | Where-Object { $_.BaseName -match "final-report" }).Count -gt 0)
        hasEvidenceSourceOfTruth = [bool](@($files | Where-Object { $_.BaseName -match "evidence-source" }).Count -gt 0)
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
    if (-not $coverage.hasIntentElicitation) {
        Add-Issue -Issues $coverageIssues -Message "At least 4 intent elicitation cases are required."
    }
    if (-not $coverage.hasVerifyRepairLoop) {
        Add-Issue -Issues $coverageIssues -Message "Missing verify/repair loop guardrail case."
    }
    if (-not $coverage.hasRepositoryReadonly) {
        Add-Issue -Issues $coverageIssues -Message "Missing repository readonly guardrail case."
    }
    if (-not $coverage.hasConservativeEdit) {
        Add-Issue -Issues $coverageIssues -Message "Missing conservative edit guardrail case."
    }
    if (-not $coverage.hasExecutionContractRequired) {
        Add-Issue -Issues $coverageIssues -Message "Missing execution contract required case."
    }
    if (-not $coverage.hasClarityGatePrototype) {
        Add-Issue -Issues $coverageIssues -Message "Missing clarity gate minimum prototype case."
    }
    if (-not $coverage.hasCapabilityGapRouting) {
        Add-Issue -Issues $coverageIssues -Message "Missing capability gap routing case."
    }
    if (-not $coverage.hasGoalPursuitLedger) {
        Add-Issue -Issues $coverageIssues -Message "Missing goal pursuit ledger case."
    }
    if (-not $coverage.hasFinalReportGate) {
        Add-Issue -Issues $coverageIssues -Message "Missing final report gate case."
    }
    if (-not $coverage.hasEvidenceSourceOfTruth) {
        Add-Issue -Issues $coverageIssues -Message "Missing evidence source-of-truth gate case."
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
