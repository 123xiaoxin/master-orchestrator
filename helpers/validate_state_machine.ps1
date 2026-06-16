<#
.SYNOPSIS
  Validate state_machine.v1 files.
.DESCRIPTION
  Checks JSON structure plus Phase 4 governance semantics:
  schemaVersion, phase, status, subtask integrity, repair budget (max 2),
  transition consistency, and resume coordinates.
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

$validStatuses = @("pending", "in_progress", "blocked", "verified", "failed", "repaired", "completed")

function Test-StateMachineFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "state_machine.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be state_machine.v1."
    }

    if (-not (Has-Property -Object $doc -Name "phase") -or $doc.phase -ne "phase_4") {
        Add-Issue -Issues $issues -Message "phase must be phase_4."
    }

    if (-not (Has-Property -Object $doc -Name "status") -or $validStatuses -notcontains [string]$doc.status) {
        Add-Issue -Issues $issues -Message "status must be one of: $($validStatuses -join ', ')."
    }

    if (-not (Has-Property -Object $doc -Name "taskId") -or [string]::IsNullOrWhiteSpace([string]$doc.taskId)) {
        Add-Issue -Issues $issues -Message "taskId must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "currentSubtaskId") -or [string]::IsNullOrWhiteSpace([string]$doc.currentSubtaskId)) {
        Add-Issue -Issues $issues -Message "currentSubtaskId must be a non-empty string."
    }

    if (-not (Has-Property -Object $doc -Name "resumeFrom")) {
        Add-Issue -Issues $issues -Message "resumeFrom must be present."
    } else {
        foreach ($field in @("subtaskId", "instruction", "requiredArtifacts")) {
            if (-not (Has-Property -Object $doc.resumeFrom -Name $field)) {
                Add-Issue -Issues $issues -Message "resumeFrom.$field must be present."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "summary")) {
        Add-Issue -Issues $issues -Message "summary must be present."
    } else {
        foreach ($field in @("goal", "completed", "remaining", "risks", "nextAction")) {
            if (-not (Has-Property -Object $doc.summary -Name $field)) {
                Add-Issue -Issues $issues -Message "summary.$field must be present."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "repairCount")) {
        Add-Issue -Issues $issues -Message "repairCount must be present."
    } else {
        $rc = [int]$doc.repairCount
        if ($rc -lt 0 -or $rc -gt 2) {
            Add-Issue -Issues $issues -Message "repairCount must be between 0 and 2."
        }
    }

    if (-not (Has-Property -Object $doc -Name "subtasks")) {
        Add-Issue -Issues $issues -Message "subtasks must be present."
    } else {
        $subtasks = @($doc.subtasks)
        if ($subtasks.Count -lt 1) {
            Add-Issue -Issues $issues -Message "subtasks must contain at least one item."
        }
        $subtaskIds = @()
        foreach ($st in $subtasks) {
            foreach ($field in @("id", "title", "status", "dependsOn", "repairCount", "artifacts", "notes")) {
                if (-not (Has-Property -Object $st -Name $field)) {
                    Add-Issue -Issues $issues -Message "subtask missing $field."
                }
            }
            if ((Has-Property -Object $st -Name "id")) {
                $subtaskIds += [string]$st.id
            }
            if ((Has-Property -Object $st -Name "status") -and $validStatuses -notcontains [string]$st.status) {
                Add-Issue -Issues $issues -Message "subtask '$($st.id)' has invalid status."
            }
            if ((Has-Property -Object $st -Name "repairCount")) {
                $stRc = [int]$st.repairCount
                if ($stRc -lt 0 -or $stRc -gt 2) {
                    Add-Issue -Issues $issues -Message "subtask '$($st.id)' repairCount must be between 0 and 2."
                }
            }
            if ((Has-Property -Object $st -Name "dependsOn")) {
                foreach ($dep in @($st.dependsOn)) {
                    if ($subtaskIds -notcontains [string]$dep -and -not [string]::IsNullOrWhiteSpace([string]$dep)) {
                    }
                }
            }
        }
    }

    if ((Has-Property -Object $doc -Name "transitions")) {
        foreach ($t in @($doc.transitions)) {
            foreach ($field in @("subtaskId", "from", "to", "reason", "at")) {
                if (-not (Has-Property -Object $t -Name $field)) {
                    Add-Issue -Issues $issues -Message "transition missing $field."
                }
            }
            if ((Has-Property -Object $t -Name "from") -and $validStatuses -notcontains [string]$t.from) {
                Add-Issue -Issues $issues -Message "transition 'from' has invalid status."
            }
            if ((Has-Property -Object $t -Name "to") -and $validStatuses -notcontains [string]$t.to) {
                Add-Issue -Issues $issues -Message "transition 'to' has invalid status."
            }
        }
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
    $results = @($files | ForEach-Object { Test-StateMachineFile -Path $_ })
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