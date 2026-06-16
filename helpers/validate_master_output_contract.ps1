<#
.SYNOPSIS
  Validate master_output_contract.v1 files.
.DESCRIPTION
  Checks JSON structure plus Clarity Gate governance semantics:
  schemaVersion, decision enum, executionClarity range, executionContract
  required fields, and nextAction presence.
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

function Resolve-InputFiles {
    param([Parameter(Mandatory = $true)][string[]]$Specs)
    $resolved = New-Object System.Collections.Generic.List[string]
    foreach ($spec in $Specs) {
        $matches = @(Get-ChildItem -Path $spec -File -ErrorAction SilentlyContinue)
        if ($matches.Count -eq 0 -and (Test-Path -LiteralPath $spec -PathType Leaf)) {
            $matches = @(Get-Item -LiteralPath $spec)
        }
        if ($matches.Count -eq 0) {
            throw "No files matched: $spec"
        }
        foreach ($match in $matches) {
            $resolved.Add((Resolve-Path -LiteralPath $match.FullName).Path) | Out-Null
        }
    }
    return @($resolved.ToArray() | Select-Object -Unique)
}

$validDecisions = @("execute", "clarify", "require_more_information", "prototype", "degrade", "block")

function Test-MasterOutputContractFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "version") -or $doc.version -ne "master_output_contract.v1") {
        Add-Issue -Issues $issues -Message "version must be master_output_contract.v1."
    }

    if (-not (Has-Property -Object $doc -Name "decision") -or $validDecisions -notcontains [string]$doc.decision) {
        Add-Issue -Issues $issues -Message "decision must be one of: $($validDecisions -join ', ')."
    }

    if (-not (Has-Property -Object $doc -Name "phase") -or [string]::IsNullOrWhiteSpace([string]$doc.phase)) {
        Add-Issue -Issues $issues -Message "phase must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "realGoal") -or [string]::IsNullOrWhiteSpace([string]$doc.realGoal)) {
        Add-Issue -Issues $issues -Message "realGoal must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "nonGoals")) {
        Add-Issue -Issues $issues -Message "nonGoals must be present."
    }

    if (-not (Has-Property -Object $doc -Name "executionClarity")) {
        Add-Issue -Issues $issues -Message "executionClarity must be present."
    } else {
        if (-not (Has-Property -Object $doc.executionClarity -Name "score")) {
            Add-Issue -Issues $issues -Message "executionClarity.score must be present."
        } else {
            $score = [int]$doc.executionClarity.score
            if ($score -lt 0 -or $score -gt 100) {
                Add-Issue -Issues $issues -Message "executionClarity.score must be between 0 and 100."
            }
        }
        if (-not (Has-Property -Object $doc.executionClarity -Name "rationale") -or [string]::IsNullOrWhiteSpace([string]$doc.executionClarity.rationale)) {
            Add-Issue -Issues $issues -Message "executionClarity.rationale must be a non-empty string."
        }
    }

    if (-not (Has-Property -Object $doc -Name "executionContract")) {
        Add-Issue -Issues $issues -Message "executionContract must be present."
    } else {
        foreach ($field in @("allowedActions", "forbiddenActions", "riskBoundaries", "validationPlan")) {
            if (-not (Has-Property -Object $doc.executionContract -Name $field)) {
                Add-Issue -Issues $issues -Message "executionContract.$field must be present."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "shouldCreateAgent")) {
        Add-Issue -Issues $issues -Message "shouldCreateAgent must be present."
    }

    if (-not (Has-Property -Object $doc -Name "nextAction") -or [string]::IsNullOrWhiteSpace([string]$doc.nextAction)) {
        Add-Issue -Issues $issues -Message "nextAction must be a non-empty string."
    }

    return [ordered]@{
        file = $Path
        ok = ($issues.Count -eq 0)
        issues = @($issues.ToArray())
    }
}

try {
    $files = Resolve-InputFiles -Specs $File
    $results = @($files | ForEach-Object { Test-MasterOutputContractFile -Path $_ })
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
} catch {
    Write-Error $_.Exception.Message
    exit 1
}