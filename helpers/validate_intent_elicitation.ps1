<#
.SYNOPSIS
  Validate intent_elicitation.v1 files and Phase -1a handoff semantics.
.PARAMETER File
  One or more JSON files or wildcard patterns.
.PARAMETER Json
  Emit a machine-readable summary.
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

function Test-NonEmptyString {
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

function Test-ArrayProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues,
        [switch]$RequireItem
    )

    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Issue -Issues $Issues -Message "$Prefix.$Name must be present."
        return @()
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
    return $items
}

function Test-LayerStatus {
    param(
        [Parameter(Mandatory = $true)]$Layer,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )

    $valid = @("concrete", "partial", "unknown")
    if (-not (Has-Property -Object $Layer -Name "status") -or $valid -notcontains [string]$Layer.status) {
        Add-Issue -Issues $Issues -Message "$Prefix.status must be concrete, partial, or unknown."
        return ""
    }
    return [string]$Layer.status
}

function Test-IntentFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $issues = New-Object System.Collections.Generic.List[string]
    try {
        $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    } catch {
        Add-Issue -Issues $issues -Message "File is not valid JSON: $($_.Exception.Message)"
        return [ordered]@{ file = $Path; ok = $false; issues = @($issues.ToArray()) }
    }

    if (-not (Has-Property -Object $doc -Name "schemaVersion") -or $doc.schemaVersion -ne "intent_elicitation.v1") {
        Add-Issue -Issues $issues -Message "schemaVersion must be intent_elicitation.v1."
    }
    Test-NonEmptyString -Object $doc -Name "userLiteralRequest" -Prefix "record" -Issues $issues

    $layerStatuses = @{}
    if (-not (Has-Property -Object $doc -Name "imagery")) {
        Add-Issue -Issues $issues -Message "imagery must be present."
    } else {
        foreach ($layerName in @("literal", "emotional", "scene", "value")) {
            if (-not (Has-Property -Object $doc.imagery -Name $layerName)) {
                Add-Issue -Issues $issues -Message "imagery.$layerName must be present."
                continue
            }
            $layer = $doc.imagery.$layerName
            $status = Test-LayerStatus -Layer $layer -Prefix "imagery.$layerName" -Issues $issues
            $layerStatuses[$layerName] = $status

            switch ($layerName) {
                "literal" {
                    $null = Test-ArrayProperty -Object $layer -Name "userWords" -Prefix "imagery.literal" -Issues $issues -RequireItem:($status -eq "concrete")
                    if (-not (Has-Property -Object $layer -Name "userRestated")) {
                        Add-Issue -Issues $issues -Message "imagery.literal.userRestated must be present."
                    } elseif ($status -eq "concrete" -and [string]::IsNullOrWhiteSpace([string]$layer.userRestated)) {
                        Add-Issue -Issues $issues -Message "Concrete imagery.literal requires userRestated."
                    }
                }
                "emotional" {
                    $null = Test-ArrayProperty -Object $layer -Name "desiredFeelings" -Prefix "imagery.emotional" -Issues $issues -RequireItem:($status -eq "concrete")
                    $null = Test-ArrayProperty -Object $layer -Name "feelingsToAvoid" -Prefix "imagery.emotional" -Issues $issues
                }
                "scene" {
                    foreach ($field in @("openingMoment", "firstAction")) {
                        if (-not (Has-Property -Object $layer -Name $field)) {
                            Add-Issue -Issues $issues -Message "imagery.scene.$field must be present."
                        } elseif ($status -eq "concrete" -and [string]::IsNullOrWhiteSpace([string]$layer.$field)) {
                            Add-Issue -Issues $issues -Message "Concrete imagery.scene requires $field."
                        }
                    }
                }
                "value" {
                    foreach ($field in @("whyItMatters", "whatItEnables")) {
                        if (-not (Has-Property -Object $layer -Name $field)) {
                            Add-Issue -Issues $issues -Message "imagery.value.$field must be present."
                        } elseif ($status -eq "concrete" -and [string]::IsNullOrWhiteSpace([string]$layer.$field)) {
                            Add-Issue -Issues $issues -Message "Concrete imagery.value requires $field."
                        }
                    }
                }
            }
        }
    }

    foreach ($arrayName in @("metaphorAnchors", "antiReferences", "intentShifts")) {
        if (-not (Has-Property -Object $doc -Name $arrayName)) {
            Add-Issue -Issues $issues -Message "$arrayName must be present."
        }
    }

    $validMetaphors = @(
        "person_in_room", "place", "weather_or_season", "animal",
        "era_or_decade", "meal", "sound_or_music", "fabric_or_texture",
        "user_supplied"
    )
    foreach ($anchor in @($doc.metaphorAnchors)) {
        if (-not (Has-Property -Object $anchor -Name "metaphor") -or $validMetaphors -notcontains [string]$anchor.metaphor) {
            Add-Issue -Issues $issues -Message "metaphorAnchors item has an invalid metaphor."
        }
        Test-NonEmptyString -Object $anchor -Name "userAnswer" -Prefix "metaphorAnchors item" -Issues $issues
        if (-not (Has-Property -Object $anchor -Name "confidence") -or @("high", "medium", "low") -notcontains [string]$anchor.confidence) {
            Add-Issue -Issues $issues -Message "metaphorAnchors item has an invalid confidence."
        }
    }

    foreach ($item in @($doc.antiReferences)) {
        foreach ($field in @("thing", "whyItIsWrong", "extract")) {
            Test-NonEmptyString -Object $item -Name $field -Prefix "antiReferences item" -Issues $issues
        }
    }
    foreach ($item in @($doc.intentShifts)) {
        foreach ($field in @("from", "to", "userSignal")) {
            Test-NonEmptyString -Object $item -Name $field -Prefix "intentShifts item" -Issues $issues
        }
    }

    if (-not (Has-Property -Object $doc -Name "stopCondition")) {
        Add-Issue -Issues $issues -Message "stopCondition must be present."
    } else {
        $validTriggers = @("four_layers_concrete", "convergence", "user_signal", "clarity_threshold_met", "turn_budget_exhausted")
        if (-not (Has-Property -Object $doc.stopCondition -Name "trigger") -or $validTriggers -notcontains [string]$doc.stopCondition.trigger) {
            Add-Issue -Issues $issues -Message "stopCondition.trigger is invalid."
        }
        Test-NonEmptyString -Object $doc.stopCondition -Name "detail" -Prefix "stopCondition" -Issues $issues
    }

    $clarity = -1.0
    if (-not (Has-Property -Object $doc -Name "executionClarityEstimate")) {
        Add-Issue -Issues $issues -Message "executionClarityEstimate must be present."
    } else {
        $clarity = [double]$doc.executionClarityEstimate
        if ($clarity -lt 0 -or $clarity -gt 1) {
            Add-Issue -Issues $issues -Message "executionClarityEstimate must be between 0 and 1."
        }
    }

    $nextPhase = [string]$doc.recommendedNextPhase
    if (@("continue_elicitation", "phase_minus_1b_clarity_gate") -notcontains $nextPhase) {
        Add-Issue -Issues $issues -Message "recommendedNextPhase must be continue_elicitation or phase_minus_1b_clarity_gate."
    }
    if ($nextPhase -eq "phase_minus_1b_clarity_gate") {
        foreach ($layerName in @("literal", "emotional", "scene", "value")) {
            if ($layerStatuses[$layerName] -ne "concrete") {
                Add-Issue -Issues $issues -Message "Phase -1b handoff requires concrete $layerName imagery."
            }
        }
        if ($clarity -lt 0.75) {
            Add-Issue -Issues $issues -Message "Phase -1b handoff requires executionClarityEstimate >= 0.75."
        }
    }

    if (-not (Has-Property -Object $doc -Name "elicitationMetadata")) {
        Add-Issue -Issues $issues -Message "elicitationMetadata must be present."
    } else {
        if (-not (Has-Property -Object $doc.elicitationMetadata -Name "turnCount") -or [int]$doc.elicitationMetadata.turnCount -lt 0) {
            Add-Issue -Issues $issues -Message "elicitationMetadata.turnCount must be a non-negative integer."
        }
        if (-not (Has-Property -Object $doc.elicitationMetadata -Name "fallbackUsed")) {
            Add-Issue -Issues $issues -Message "elicitationMetadata.fallbackUsed must be present."
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
    $results = @($files | ForEach-Object { Test-IntentFile -Path $_ })
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
