<#
.SYNOPSIS
  Validate goal_pursuit_ledger.v1 files.
.DESCRIPTION
  Checks the Goal Pursuit Ledger contract records used by Master governance.
  This validator does not persist runtime memory or run background tasks.
.PARAMETER File
  One or more files or wildcard patterns.
.PARAMETER Json
  Emit a machine-readable JSON result.
#>

param(
    [Parameter(Mandatory = $true)]
    [string[]]$File,

    [Parameter(Mandatory = $false)]
    [switch]$Json
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\Common.ps1"

$validConsistency = @("passed", "failed", "not_checked")
$validReviewModes = @("internal_checklist", "specialist_review", "independent_counter_agent", "human_review", "degraded_review")
$validFinalStatuses = @("completed", "partial", "blocked", "failed")

function Test-RequiredString {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $Object -Name $Name) -or [string]::IsNullOrWhiteSpace([string]$Object.$Name)) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be a non-empty string."
    }
}

function Test-StringArray {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues,
        [switch]$RequireItem
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be present."
        return
    }
    $items = @($Object.$Name)
    if ($RequireItem -and $items.Count -lt 1) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must contain at least one item."
    }
    foreach ($item in $items) {
        if ([string]::IsNullOrWhiteSpace([string]$item)) {
            Add-Issue -Issues $Issues -Message "$Prefix.$Name contains an empty item."
        }
    }
}

function Test-BooleanField {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be present."
    } elseif ($Object.$Name -isnot [bool]) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be a boolean."
    }
}

function Test-GoalPursuitLedgerFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "goal_pursuit_ledger.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be goal_pursuit_ledger.v1."
    }
    Test-RequiredString -Object $doc -Name "taskId" -Prefix "record" -Issues $issues
    Test-RequiredString -Object $doc -Name "updatedAt" -Prefix "record" -Issues $issues

    foreach ($section in @("goalAnchor", "progressLedger", "evidenceLedger", "capabilityFailureDisclosure", "reviewLedger", "completionVerification")) {
        if (-not (Has-Property -Object $doc -Name $section)) {
            Add-Issue -Issues $issues -Message "$section must be present."
        }
    }

    if (Has-Property -Object $doc -Name "goalAnchor") {
        Test-RequiredString -Object $doc.goalAnchor -Name "trueGoal" -Prefix "goalAnchor" -Issues $issues
        Test-RequiredString -Object $doc.goalAnchor -Name "userValue" -Prefix "goalAnchor" -Issues $issues
        Test-StringArray -Object $doc.goalAnchor -Name "nonGoals" -Prefix "goalAnchor" -Issues $issues
        Test-StringArray -Object $doc.goalAnchor -Name "successCriteria" -Prefix "goalAnchor" -Issues $issues -RequireItem
        Test-RequiredString -Object $doc.goalAnchor -Name "riskBoundary" -Prefix "goalAnchor" -Issues $issues
    }

    if (Has-Property -Object $doc -Name "progressLedger") {
        Test-RequiredString -Object $doc.progressLedger -Name "currentPhase" -Prefix "progressLedger" -Issues $issues
        Test-StringArray -Object $doc.progressLedger -Name "completed" -Prefix "progressLedger" -Issues $issues
        Test-StringArray -Object $doc.progressLedger -Name "inProgress" -Prefix "progressLedger" -Issues $issues
        Test-StringArray -Object $doc.progressLedger -Name "blocked" -Prefix "progressLedger" -Issues $issues
        Test-RequiredString -Object $doc.progressLedger -Name "nextAction" -Prefix "progressLedger" -Issues $issues
        foreach ($optionalText in @("deviation", "risk", "lastVerification")) {
            if (-not (Has-Property -Object $doc.progressLedger -Name $optionalText)) {
                Add-Issue -Issues $issues -Message "progressLedger.$optionalText must be present."
            }
        }
    }

    if (Has-Property -Object $doc -Name "evidenceLedger") {
        Test-StringArray -Object $doc.evidenceLedger -Name "readFiles" -Prefix "evidenceLedger" -Issues $issues
        Test-StringArray -Object $doc.evidenceLedger -Name "toolCalls" -Prefix "evidenceLedger" -Issues $issues
        Test-StringArray -Object $doc.evidenceLedger -Name "assumptions" -Prefix "evidenceLedger" -Issues $issues
        Test-StringArray -Object $doc.evidenceLedger -Name "unavailableEvidence" -Prefix "evidenceLedger" -Issues $issues
        if ((Has-Property -Object $doc.evidenceLedger -Name "forbiddenEvidence")) {
            foreach ($item in @($doc.evidenceLedger.forbiddenEvidence)) {
                if ([string]::IsNullOrWhiteSpace([string]$item)) {
                    Add-Issue -Issues $issues -Message "evidenceLedger.forbiddenEvidence contains an empty item."
                }
            }
        }
        if (-not (Has-Property -Object $doc.evidenceLedger -Name "finalReportConsistencyCheck") -or $validConsistency -notcontains [string]$doc.evidenceLedger.finalReportConsistencyCheck) {
            Add-Issue -Issues $issues -Message "evidenceLedger.finalReportConsistencyCheck must be one of: $($validConsistency -join ', ')."
        }
    }

    if (Has-Property -Object $doc -Name "capabilityFailureDisclosure") {
        Test-StringArray -Object $doc.capabilityFailureDisclosure -Name "failedTools" -Prefix "capabilityFailureDisclosure" -Issues $issues
        Test-StringArray -Object $doc.capabilityFailureDisclosure -Name "unavailableCapabilities" -Prefix "capabilityFailureDisclosure" -Issues $issues
        Test-StringArray -Object $doc.capabilityFailureDisclosure -Name "degradedCapabilities" -Prefix "capabilityFailureDisclosure" -Issues $issues
        Test-BooleanField -Object $doc.capabilityFailureDisclosure -Name "whetherDisclosedInFinalReport" -Prefix "capabilityFailureDisclosure" -Issues $issues
    }

    if (Has-Property -Object $doc -Name "reviewLedger") {
        Test-StringArray -Object $doc.reviewLedger -Name "requiredReview" -Prefix "reviewLedger" -Issues $issues
        if (-not (Has-Property -Object $doc.reviewLedger -Name "reviewMode") -or $validReviewModes -notcontains [string]$doc.reviewLedger.reviewMode) {
            Add-Issue -Issues $issues -Message "reviewLedger.reviewMode must be one of: $($validReviewModes -join ', ')."
        }
        Test-BooleanField -Object $doc.reviewLedger -Name "counterAgentUsed" -Prefix "reviewLedger" -Issues $issues
        Test-BooleanField -Object $doc.reviewLedger -Name "humanConfirmationNeeded" -Prefix "reviewLedger" -Issues $issues
    }

    if (Has-Property -Object $doc -Name "completionVerification") {
        Test-BooleanField -Object $doc.completionVerification -Name "goalAchieved" -Prefix "completionVerification" -Issues $issues
        Test-BooleanField -Object $doc.completionVerification -Name "verificationPassed" -Prefix "completionVerification" -Issues $issues
        if (-not (Has-Property -Object $doc.completionVerification -Name "finalStatus") -or $validFinalStatuses -notcontains [string]$doc.completionVerification.finalStatus) {
            Add-Issue -Issues $issues -Message "completionVerification.finalStatus must be one of: $($validFinalStatuses -join ', ')."
        }
    }

    if ((Has-Property -Object $doc -Name "completionVerification") -and [string]$doc.completionVerification.finalStatus -eq "completed") {
        if ((Has-Property -Object $doc.completionVerification -Name "goalAchieved") -and -not $doc.completionVerification.goalAchieved) {
            Add-Issue -Issues $issues -Message "finalStatus cannot be completed when goalAchieved is false."
        }
        if ((Has-Property -Object $doc.completionVerification -Name "verificationPassed") -and -not $doc.completionVerification.verificationPassed) {
            Add-Issue -Issues $issues -Message "finalStatus cannot be completed when verificationPassed is false."
        }
        if ((Has-Property -Object $doc -Name "evidenceLedger") -and [string]$doc.evidenceLedger.finalReportConsistencyCheck -ne "passed") {
            Add-Issue -Issues $issues -Message "finalStatus cannot be completed unless evidenceLedger.finalReportConsistencyCheck is passed."
        }
    }

    return [ordered]@{
        file = $Path
        ok = ($issues.Count -eq 0)
        issues = @($issues.ToArray())
    }
}

try {
    $files = Resolve-InputFiles -Specs $File
    $results = @($files | ForEach-Object { Test-GoalPursuitLedgerFile -Path $_ })
    $failed = @($results | Where-Object { -not $_.ok })
    $summary = [ordered]@{
        ok = ($failed.Count -eq 0)
        total = $results.Count
        failed = $failed.Count
        results = @($results)
    }

    if ($Json) {
        Write-Output ($summary | ConvertTo-Json -Depth 8 -Compress)
    } else {
        foreach ($result in $results) {
            if ($result.ok) {
                Write-Output "OK $($result.file)"
            } else {
                Write-Output "FAIL $($result.file)"
                foreach ($issue in $result.issues) {
                    Write-Output "  - $issue"
                }
            }
        }
    }

    if ($failed.Count -gt 0) {
        exit 1
    }
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
