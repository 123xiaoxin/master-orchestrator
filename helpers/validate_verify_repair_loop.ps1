<#
.SYNOPSIS
  Validate verify_repair_loop.v1 files.
.DESCRIPTION
  Checks JSON structure plus Harness governance semantics:
  schemaVersion, bounded repair (maxAttempts=2), attempt tracking,
  status progression, and nextAction after each round.
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

$validStatuses = @(
    "pending_verification",
    "verification_failed",
    "repair_in_progress",
    "repaired",
    "verification_passed",
    "exhausted",
    "needs_user_decision"
)

$validAttemptResults = @(
    "repair_applied",
    "verification_passed",
    "verification_failed",
    "needs_user_decision",
    "exhausted"
)

function Test-VerifyRepairFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "verify_repair_loop.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be verify_repair_loop.v1."
    }

    if (-not (Has-Property -Object $doc -Name "target") -or [string]::IsNullOrWhiteSpace([string]$doc.target)) {
        Add-Issue -Issues $issues -Message "target must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "verifyStep")) {
        Add-Issue -Issues $issues -Message "verifyStep must be present."
    } else {
        foreach ($field in @("command", "scope")) {
            if (-not (Has-Property -Object $doc.verifyStep -Name $field) -or [string]::IsNullOrWhiteSpace([string]$doc.verifyStep.$field)) {
                Add-Issue -Issues $issues -Message "verifyStep.$field must be a non-empty string."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "expectedSignal") -or [string]::IsNullOrWhiteSpace([string]$doc.expectedSignal)) {
        Add-Issue -Issues $issues -Message "expectedSignal must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "status") -or $validStatuses -notcontains [string]$doc.status) {
        Add-Issue -Issues $issues -Message "status must be one of: $($validStatuses -join ', ')."
    }

    if (-not (Has-Property -Object $doc -Name "maxAttempts") -or [int]$doc.maxAttempts -ne 2) {
        Add-Issue -Issues $issues -Message "maxAttempts must be 2."
    }

    if (-not (Has-Property -Object $doc -Name "attempt")) {
        Add-Issue -Issues $issues -Message "attempt must be present."
    } else {
        $attempt = [int]$doc.attempt
        if ($attempt -lt 0 -or $attempt -gt 2) {
            Add-Issue -Issues $issues -Message "attempt must be between 0 and 2."
        }
    }

    if (-not (Has-Property -Object $doc -Name "attempts")) {
        Add-Issue -Issues $issues -Message "attempts must be present."
    } else {
        $attempts = @($doc.attempts)
        if ($attempts.Count -gt 2) {
            Add-Issue -Issues $issues -Message "attempts must not exceed 2 items."
        }
        foreach ($a in $attempts) {
            foreach ($field in @("attempt", "failureReason", "repairAction", "result")) {
                if (-not (Has-Property -Object $a -Name $field)) {
                    Add-Issue -Issues $issues -Message "attempt item missing $field."
                }
            }
            if ((Has-Property -Object $a -Name "result") -and $validAttemptResults -notcontains [string]$a.result) {
                Add-Issue -Issues $issues -Message "attempt item has invalid result."
            }
            if ((Has-Property -Object $a -Name "repairAction")) {
                foreach ($field in @("summary", "changedFiles")) {
                    if (-not (Has-Property -Object $a.repairAction -Name $field)) {
                        Add-Issue -Issues $issues -Message "repairAction missing $field."
                    }
                }
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "nextAction") -or [string]::IsNullOrWhiteSpace([string]$doc.nextAction)) {
        Add-Issue -Issues $issues -Message "nextAction must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "updatedAt")) {
        Add-Issue -Issues $issues -Message "updatedAt must be present."
    }

    return [ordered]@{
        file = $Path
        ok = ($issues.Count -eq 0)
        issues = @($issues.ToArray())
    }
}

try {
    $files = Resolve-InputFiles -Specs $File
    $results = @($files | ForEach-Object { Test-VerifyRepairFile -Path $_ })
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