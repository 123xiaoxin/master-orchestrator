<#
.SYNOPSIS
  Validate five_layer_snapshot.v1 files.
.DESCRIPTION
  Checks the five Agent Performance Stack layers and fit enums. This validator
  validates contract records only and does not inspect a live runtime.
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

$validFit = @("sufficient", "partial", "weak", "unknown")

function Test-StringArrayItems {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (Has-Property -Object $Object -Name $Name) {
        foreach ($item in @($Object.$Name)) {
            if ([string]::IsNullOrWhiteSpace([string]$item)) {
                Add-Issue -Issues $Issues -Message "$Prefix.$Name contains an empty item."
            }
        }
    }
}

function Test-LayerFit {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [System.Collections.Generic.List[string]]$Issues
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Name must be present."
        return
    }
    $layer = $Object.$Name
    if (-not (Has-Property -Object $layer -Name "fit") -or $validFit -notcontains [string]$layer.fit) {
        Add-Issue -Issues $Issues -Message "$Name.fit must be one of: $($validFit -join ', ')."
    }
}

function Test-FiveLayerSnapshotFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "five_layer_snapshot.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be five_layer_snapshot.v1."
    }

    foreach ($layerName in @("modelLayer", "harnessLayer", "promptLayer", "skillLayer", "ragMemoryLayer")) {
        Test-LayerFit -Object $doc -Name $layerName -Issues $issues
    }

    if (Has-Property -Object $doc -Name "modelLayer") {
        Test-StringArrayItems -Object $doc.modelLayer -Name "notes" -Prefix "modelLayer" -Issues $issues
    }
    if (Has-Property -Object $doc -Name "harnessLayer") {
        Test-StringArrayItems -Object $doc.harnessLayer -Name "requiredControls" -Prefix "harnessLayer" -Issues $issues
    }
    if (Has-Property -Object $doc -Name "promptLayer") {
        Test-StringArrayItems -Object $doc.promptLayer -Name "requiredViews" -Prefix "promptLayer" -Issues $issues
    }
    if (Has-Property -Object $doc -Name "skillLayer") {
        Test-StringArrayItems -Object $doc.skillLayer -Name "availableTools" -Prefix "skillLayer" -Issues $issues
        Test-StringArrayItems -Object $doc.skillLayer -Name "missingTools" -Prefix "skillLayer" -Issues $issues
    }
    if (Has-Property -Object $doc -Name "ragMemoryLayer") {
        Test-StringArrayItems -Object $doc.ragMemoryLayer -Name "requiredContext" -Prefix "ragMemoryLayer" -Issues $issues
        Test-StringArrayItems -Object $doc.ragMemoryLayer -Name "missingContext" -Prefix "ragMemoryLayer" -Issues $issues
    }

    return [ordered]@{
        file = $Path
        ok = ($issues.Count -eq 0)
        issues = @($issues.ToArray())
    }
}

try {
    $files = Resolve-InputFiles -Specs $File
    $results = @($files | ForEach-Object { Test-FiveLayerSnapshotFile -Path $_ })
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
