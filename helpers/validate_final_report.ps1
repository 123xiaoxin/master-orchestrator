<#
.SYNOPSIS
  Validate final_report.v1 files.
.DESCRIPTION
  Checks final report contract records and the source-of-truth gate semantics
  needed to avoid reporting unverified runtime evidence as completion.
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

$validResults = @("passed", "failed", "skipped")
$validDepositionTargets = @("", "prompt", "harness", "skill", "rag_memory", "model_selection_note")
$validFinalStatuses = @("completed", "partial", "blocked", "failed")

function Test-StringArray {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be present."
        return
    }
    foreach ($item in @($Object.$Name)) {
        if ([string]::IsNullOrWhiteSpace([string]$item)) {
            Add-Issue -Issues $Issues -Message "$Prefix.$Name contains an empty item."
        }
    }
}

function Test-FinalReportFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "final_report.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be final_report.v1."
    }
    if (-not (Has-Property -Object $doc -Name "taskId") -or [string]::IsNullOrWhiteSpace([string]$doc.taskId)) {
        Add-Issue -Issues $issues -Message "taskId must be a non-empty string."
    }
    Test-StringArray -Object $doc -Name "completed" -Prefix "record" -Issues $issues
    Test-StringArray -Object $doc -Name "risks" -Prefix "record" -Issues $issues
    Test-StringArray -Object $doc -Name "unfinishedItems" -Prefix "record" -Issues $issues
    Test-StringArray -Object $doc -Name "nextActions" -Prefix "record" -Issues $issues

    if (-not (Has-Property -Object $doc -Name "verificationResults")) {
        Add-Issue -Issues $issues -Message "verificationResults must be present."
    } else {
        $items = @($doc.verificationResults)
        for ($i = 0; $i -lt $items.Count; $i++) {
            $item = $items[$i]
            if (-not (Has-Property -Object $item -Name "check") -or [string]::IsNullOrWhiteSpace([string]$item.check)) {
                Add-Issue -Issues $issues -Message "verificationResults[$i].check must be a non-empty string."
            }
            if (-not (Has-Property -Object $item -Name "result") -or $validResults -notcontains [string]$item.result) {
                Add-Issue -Issues $issues -Message "verificationResults[$i].result must be one of: $($validResults -join ', ')."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "skillDepositionCandidate")) {
        Add-Issue -Issues $issues -Message "skillDepositionCandidate must be present."
    } elseif ($doc.skillDepositionCandidate -isnot [bool]) {
        Add-Issue -Issues $issues -Message "skillDepositionCandidate must be a boolean."
    }
    if (-not (Has-Property -Object $doc -Name "depositionTarget") -or $validDepositionTargets -notcontains [string]$doc.depositionTarget) {
        Add-Issue -Issues $issues -Message "depositionTarget must be one of: '$($validDepositionTargets -join "', '")'."
    }
    if (-not (Has-Property -Object $doc -Name "finalStatus") -or $validFinalStatuses -notcontains [string]$doc.finalStatus) {
        Add-Issue -Issues $issues -Message "finalStatus must be one of: $($validFinalStatuses -join ', ')."
    }
    if (-not (Has-Property -Object $doc -Name "updatedAt") -or [string]::IsNullOrWhiteSpace([string]$doc.updatedAt)) {
        Add-Issue -Issues $issues -Message "updatedAt must be a non-empty string."
    }

    if (Has-Property -Object $doc -Name "sourceOfTruthGate") {
        $gate = $doc.sourceOfTruthGate
        foreach ($boolField in @("declaredEvidenceMatchesObservedEvidence", "asyncBoundaryIncomplete", "ledgerUnverified")) {
            if ((Has-Property -Object $gate -Name $boolField) -and ($gate.$boolField -isnot [bool])) {
                Add-Issue -Issues $issues -Message "sourceOfTruthGate.$boolField must be a boolean."
            }
        }
        foreach ($arrField in @("unaccountedToolCalls", "inventedToolCalls", "phaseAttributionMismatch", "counterAgentTruthMismatch")) {
            if (Has-Property -Object $gate -Name $arrField) {
                foreach ($item in @($gate.$arrField)) {
                    if ([string]::IsNullOrWhiteSpace([string]$item)) {
                        Add-Issue -Issues $issues -Message "sourceOfTruthGate.$arrField contains an empty item."
                    }
                }
            }
        }
        $hasMismatch = @(
            @($gate.unaccountedToolCalls).Count,
            @($gate.inventedToolCalls).Count,
            @($gate.phaseAttributionMismatch).Count,
            @($gate.counterAgentTruthMismatch).Count
        ) | Where-Object { $_ -gt 0 }
        if ([string]$doc.finalStatus -eq "completed") {
            if ((Has-Property -Object $gate -Name "declaredEvidenceMatchesObservedEvidence") -and -not $gate.declaredEvidenceMatchesObservedEvidence) {
                Add-Issue -Issues $issues -Message "finalStatus cannot be completed when declared evidence does not match observed evidence."
            }
            if ((Has-Property -Object $gate -Name "asyncBoundaryIncomplete") -and $gate.asyncBoundaryIncomplete) {
                Add-Issue -Issues $issues -Message "finalStatus cannot be completed when asyncBoundaryIncomplete is true."
            }
            if ((Has-Property -Object $gate -Name "ledgerUnverified") -and $gate.ledgerUnverified) {
                Add-Issue -Issues $issues -Message "finalStatus cannot be completed when ledgerUnverified is true."
            }
            if (@($hasMismatch).Count -gt 0) {
                Add-Issue -Issues $issues -Message "finalStatus cannot be completed when sourceOfTruthGate mismatch arrays are non-empty."
            }
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
    $results = @($files | ForEach-Object { Test-FinalReportFile -Path $_ })
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
