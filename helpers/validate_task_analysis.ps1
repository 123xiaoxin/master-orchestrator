<#
.SYNOPSIS
  Validate task_analysis.v1 files.
.DESCRIPTION
  Checks JSON structure plus v5.4 governance semantics:
  goal/nonGoals, deliverables, successCriteria, environmentSnapshot,
  capabilityMapping, routingDecision, and heartbeat=0 for delegated work.
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

function ConvertTo-Array {
    param($Value)
    if ($null -eq $Value) {
        return ,@()
    }
    return ,@($Value)
}

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

function Test-StringField {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $Object -Name $Name) -or [string]::IsNullOrWhiteSpace([string]$Object.$Name)) {
        Add-Issue -Issues $Issues -Message "$Name must be a non-empty string."
    }
}

function Test-ArrayField {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [System.Collections.Generic.List[string]]$Issues,
        [Parameter(Mandatory = $false)][switch]$AllowEmpty
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Name must be present."
        return @()
    }
    $items = ConvertTo-Array -Value $Object.$Name
    if (-not $AllowEmpty -and $items.Count -lt 1) {
        Add-Issue -Issues $Issues -Message "$Name must contain at least one item."
    }
    foreach ($item in $items) {
        if ([string]::IsNullOrWhiteSpace([string]$item)) {
            Add-Issue -Issues $Issues -Message "$Name contains an empty item."
        }
    }
    return ,$items
}

function Test-MicroSop {
    param(
        [Parameter(Mandatory = $true)]$MicroSop,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $MicroSop -Name "schemaVersion") -or $MicroSop.schemaVersion -ne "micro_sop.v1") {
        Add-Issue -Issues $Issues -Message "$Prefix.schemaVersion must be micro_sop.v1."
    }
    foreach ($field in @("context", "deliverable", "exitCondition")) {
        if (-not (Has-Property -Object $MicroSop -Name $field) -or [string]::IsNullOrWhiteSpace([string]$MicroSop.$field)) {
            Add-Issue -Issues $Issues -Message "$Prefix.$field must be a non-empty string."
        }
    }
    $negativeConstraints = Test-ArrayField -Object $MicroSop -Name "negativeConstraints" -Issues $Issues
    $null = $negativeConstraints

    if (-not (Has-Property -Object $MicroSop -Name "budget")) {
        Add-Issue -Issues $Issues -Message "$Prefix.budget must be present."
        return
    }
    if (-not (Has-Property -Object $MicroSop.budget -Name "heartbeat") -or [int]$MicroSop.budget.heartbeat -ne 0) {
        Add-Issue -Issues $Issues -Message "$Prefix.budget.heartbeat must be 0."
    }
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

function Test-TaskAnalysisFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "task_analysis.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be task_analysis.v1."
    }

    Test-StringField -Object $doc -Name "intent" -Issues $issues
    Test-StringField -Object $doc -Name "goal" -Issues $issues
    $null = Test-ArrayField -Object $doc -Name "nonGoals" -Issues $issues
    $null = Test-ArrayField -Object $doc -Name "deliverables" -Issues $issues
    $null = Test-ArrayField -Object $doc -Name "constraints" -Issues $issues -AllowEmpty
    $null = Test-ArrayField -Object $doc -Name "successCriteria" -Issues $issues

    if (-not (Has-Property -Object $doc -Name "environmentSnapshot")) {
        Add-Issue -Issues $issues -Message "environmentSnapshot must be present."
    } else {
        foreach ($field in @("maxSpawnDepth", "maxChildrenPerAgent", "expertLibraryAvailable", "userAgentsBypassed")) {
            if (-not (Has-Property -Object $doc.environmentSnapshot -Name $field)) {
                Add-Issue -Issues $issues -Message "environmentSnapshot.$field must be present."
            }
        }
        if ((Has-Property -Object $doc.environmentSnapshot -Name "userAgentsBypassed") -and $doc.environmentSnapshot.userAgentsBypassed -ne $true) {
            Add-Issue -Issues $issues -Message "environmentSnapshot.userAgentsBypassed must be true."
        }
    }

    $capabilities = Test-ArrayField -Object $doc -Name "capabilityMapping" -Issues $issues
    foreach ($capability in $capabilities) {
        foreach ($field in @("capability", "required", "matchedBy", "fallback")) {
            if (-not (Has-Property -Object $capability -Name $field)) {
                Add-Issue -Issues $issues -Message "capabilityMapping item missing $field."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "routingDecision")) {
        Add-Issue -Issues $issues -Message "routingDecision must be present."
    } else {
        $routing = $doc.routingDecision
        $validModes = @("master_only", "create_temp_agent", "create_subagent", "create_agent_pack", "staged_execution", "downgrade_or_clarify")
        if (-not (Has-Property -Object $routing -Name "mode") -or $validModes -notcontains [string]$routing.mode) {
            Add-Issue -Issues $issues -Message "routingDecision.mode is invalid."
        }
        if (-not (Has-Property -Object $routing -Name "reason") -or [string]::IsNullOrWhiteSpace([string]$routing.reason)) {
            Add-Issue -Issues $issues -Message "routingDecision.reason must be non-empty."
        }
        if (-not (Has-Property -Object $routing -Name "agentCount")) {
            Add-Issue -Issues $issues -Message "routingDecision.agentCount must be present."
        } else {
            $agentCount = [int]$routing.agentCount
            switch ([string]$routing.mode) {
                "master_only" {
                    if ($agentCount -ne 0) {
                        Add-Issue -Issues $issues -Message "master_only routing requires agentCount=0."
                    }
                }
                { $_ -in @("create_temp_agent", "create_subagent", "create_agent_pack", "staged_execution") } {
                    if ($agentCount -lt 1 -or $agentCount -gt 5) {
                        Add-Issue -Issues $issues -Message "$($routing.mode) routing requires agentCount between 1 and 5."
                    }
                }
                "downgrade_or_clarify" {
                    $fallbacks = @($capabilities | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.fallback) })
                    if ($fallbacks.Count -lt 1) {
                        Add-Issue -Issues $issues -Message "downgrade_or_clarify requires at least one capability fallback."
                    }
                }
            }
        }
    }

    $mode = if (Has-Property -Object $doc -Name "routingDecision") { [string]$doc.routingDecision.mode } else { "" }
    if ($mode -in @("create_temp_agent", "create_subagent", "create_agent_pack", "staged_execution")) {
        if (-not (Has-Property -Object $doc -Name "microSops")) {
            Add-Issue -Issues $issues -Message "Delegated routing requires microSops."
        } else {
            $microSops = ConvertTo-Array -Value $doc.microSops
            if ($microSops.Count -lt 1) {
                Add-Issue -Issues $issues -Message "Delegated routing requires at least one microSop."
            }
            for ($i = 0; $i -lt $microSops.Count; $i++) {
                Test-MicroSop -MicroSop $microSops[$i] -Prefix "microSops[$i]" -Issues $issues
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
    $results = @($files | ForEach-Object { Test-TaskAnalysisFile -Path $_ })
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
