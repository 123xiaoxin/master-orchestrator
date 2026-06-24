<#
.SYNOPSIS
  Validate capability_gap.v1 files.
.DESCRIPTION
  Checks JSON shape and core Capability Gap Decision semantics. This validator
  only validates examples and contract records; it does not route or execute
  capabilities.
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

$validRoutes = @("degrade", "substitute", "install_or_enable", "generate_temporary_capability", "manual_handoff")
$validRiskLevels = @("L0", "L1", "L2", "L3", "L4", "L5")

function Test-CapabilityGapFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "capability_gap.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be capability_gap.v1."
    }
    foreach ($field in @("missingCapability", "impact", "verificationPlan", "fallback")) {
        if (-not (Has-Property -Object $doc -Name $field) -or [string]::IsNullOrWhiteSpace([string]$doc.$field)) {
            Add-Issue -Issues $issues -Message "$field must be a non-empty string."
        }
    }

    if (-not (Has-Property -Object $doc -Name "candidateRoutes")) {
        Add-Issue -Issues $issues -Message "candidateRoutes must be present."
    } else {
        $routes = @($doc.candidateRoutes)
        if ($routes.Count -lt 1) {
            Add-Issue -Issues $issues -Message "candidateRoutes must contain at least one item."
        }
        for ($i = 0; $i -lt $routes.Count; $i++) {
            $route = $routes[$i]
            if (-not (Has-Property -Object $route -Name "route") -or $validRoutes -notcontains [string]$route.route) {
                Add-Issue -Issues $issues -Message "candidateRoutes[$i].route must be one of: $($validRoutes -join ', ')."
            }
            if (-not (Has-Property -Object $route -Name "reason") -or [string]::IsNullOrWhiteSpace([string]$route.reason)) {
                Add-Issue -Issues $issues -Message "candidateRoutes[$i].reason must be a non-empty string."
            }
            if (-not (Has-Property -Object $route -Name "riskLevel") -or $validRiskLevels -notcontains [string]$route.riskLevel) {
                Add-Issue -Issues $issues -Message "candidateRoutes[$i].riskLevel must be one of: $($validRiskLevels -join ', ')."
            }
            if (-not (Has-Property -Object $route -Name "requiresUserAuthorization")) {
                Add-Issue -Issues $issues -Message "candidateRoutes[$i].requiresUserAuthorization must be present."
            } elseif ($route.requiresUserAuthorization -isnot [bool]) {
                Add-Issue -Issues $issues -Message "candidateRoutes[$i].requiresUserAuthorization must be a boolean."
            }
        }
    }

    if (-not (Has-Property -Object $doc -Name "selectedRoute") -or $validRoutes -notcontains [string]$doc.selectedRoute) {
        Add-Issue -Issues $issues -Message "selectedRoute must be one of: $($validRoutes -join ', ')."
    }
    if (-not (Has-Property -Object $doc -Name "riskLevel") -or $validRiskLevels -notcontains [string]$doc.riskLevel) {
        Add-Issue -Issues $issues -Message "riskLevel must be one of: $($validRiskLevels -join ', ')."
    }
    if (-not (Has-Property -Object $doc -Name "requiresUserAuthorization")) {
        Add-Issue -Issues $issues -Message "requiresUserAuthorization must be present."
    } elseif ($doc.requiresUserAuthorization -isnot [bool]) {
        Add-Issue -Issues $issues -Message "requiresUserAuthorization must be a boolean."
    }

    if ((Has-Property -Object $doc -Name "selectedRoute") -and (Has-Property -Object $doc -Name "candidateRoutes")) {
        $candidateRouteNames = @($doc.candidateRoutes | ForEach-Object {
            if (Has-Property -Object $_ -Name "route") { [string]$_.route }
        })
        if ($candidateRouteNames -notcontains [string]$doc.selectedRoute) {
            Add-Issue -Issues $issues -Message "selectedRoute '$($doc.selectedRoute)' is not among candidateRoutes."
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
    $results = @($files | ForEach-Object { Test-CapabilityGapFile -Path $_ })
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
