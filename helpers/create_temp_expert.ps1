<#
.SYNOPSIS
  Create one temporary OpenClaw agent from an agency-agents expert.
.DESCRIPTION
  Resolves the expert definition from either:
  - -ExpertFile pointing to a file
  - -ExpertFile pointing to an expert directory
  - -ExpertName resolving to ~/.openclaw/agency-agents/<ExpertName>/AGENTS.md

  The script writes only the final machine-readable result to the success
  pipeline. Progress messages use Write-Host so callers can capture JSON.
.PARAMETER ExpertName
  Expert id, for example frontend-developer.
.PARAMETER ExpertFile
  Optional expert definition file or expert directory. If omitted, the script
  uses ~/.openclaw/agency-agents/<ExpertName>/AGENTS.md.
.PARAMETER Model
  Optional explicit model id. When omitted, the script scans local OpenClaw
  model status and chooses a model by naming convention.
.PARAMETER BatchId
  Optional pack/run id. When provided, it is included in the temporary agent id.
.OUTPUTS
  JSON: {"agentId":"...","expertName":"...","model":"...","modelSelectionReason":"...","workspace":"...","agentDir":"...","expertFile":"...","batchId":"..."}
.EXAMPLE
  .\create_temp_expert.ps1 -ExpertName frontend-developer
.EXAMPLE
  .\create_temp_expert.ps1 -ExpertName frontend-developer -Model "deepseek/deepseek-chat"
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$ExpertName,

    [Parameter(Mandatory = $false)]
    [string]$ExpertFile = "",

    [Parameter(Mandatory = $false)]
    [string]$Model = "",

    [Parameter(Mandatory = $false)]
    [ValidatePattern('^[A-Za-z0-9._-]*$')]
    [string]$BatchId = ""
)

$ErrorActionPreference = "Stop"

function ConvertTo-SafeId {
    param([Parameter(Mandatory = $true)][string]$Value)
    $safe = $Value -replace '[^A-Za-z0-9._-]', '-'
    $safe = $safe.Trim('-')
    if ([string]::IsNullOrWhiteSpace($safe)) {
        throw "Cannot convert value to a safe id: $Value"
    }
    return $safe
}

function Resolve-ExpertFile {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $false)][string]$Path
    )

    $candidates = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace($Path)) {
        $expanded = [Environment]::ExpandEnvironmentVariables($Path)
        if (Test-Path -LiteralPath $expanded -PathType Container) {
            $candidates.Add((Join-Path $expanded "AGENTS.md"))
        } else {
            $candidates.Add($expanded)
        }
    }

    $agencyRoot = Join-Path $env:USERPROFILE ".openclaw\agency-agents"
    $candidates.Add((Join-Path (Join-Path $agencyRoot $Name) "AGENTS.md"))

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $tried = $candidates -join "; "
    throw "Expert definition not found for '$Name'. Tried: $tried"
}

function Get-ModelChoice {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $false)][string]$ExplicitModel
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitModel)) {
        Write-Host "Using explicit model: $ExplicitModel"
        return [pscustomobject]@{
            model = $ExplicitModel
            reason = "explicit model override"
        }
    }

    Write-Host "Scanning OpenClaw models..."
    $modelsJson = & openclaw models status --json 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not read OpenClaw model status. Agent will use OpenClaw default model. Details: $modelsJson"
        return [pscustomobject]@{
            model = ""
            reason = "model status unavailable; omitted --model so OpenClaw default applies"
        }
    }

    $models = $modelsJson | ConvertFrom-Json
    $allModels = @($models.allowed)
    $defaultModel = $models.defaultModel
    $fallbacks = @($models.fallbacks)

    $codeKeywords = @("code", "coder", "coding")
    $fastKeywords = @("highspeed", "fast", "speed", "quick", "turbo", "lite")
    $fastSuffix = "-mini$|_mini$|\.mini$"

    $codeModels = $allModels | Where-Object {
        $id = $_.ToLowerInvariant()
        ($codeKeywords | Where-Object { $id -match $_ }) -ne $null
    }

    $fastModels = $allModels | Where-Object {
        $id = $_.ToLowerInvariant()
        (($fastKeywords | Where-Object { $id -match $_ }) -ne $null) -or ($id -match $fastSuffix)
    }

    $expert = $Name.ToLowerInvariant()
    $codeExpertPattern = @(
        "developer", "architect", "engineer", "programmer", "coder",
        "builder", "maintainer", "automator", "tester",
        "frontend", "backend", "fullstack", "mobile", "devops"
    )
    if (($codeExpertPattern | Where-Object { $expert -match $_ }) -and $codeModels) {
        return [pscustomobject]@{
            model = ($codeModels | Select-Object -First 1)
            reason = "expert name matched code role pattern; selected first model containing code/coder/coding"
        }
    }

    $fastExpertPattern = @("highspeed", "lightweight", "quick", "fast")
    if (($fastExpertPattern | Where-Object { $expert -match $_ }) -and $fastModels) {
        return [pscustomobject]@{
            model = ($fastModels | Select-Object -First 1)
            reason = "expert name matched fast role pattern; selected first fast/turbo/lite/mini model"
        }
    }

    if ($defaultModel) {
        return [pscustomobject]@{
            model = $defaultModel
            reason = "no specialized model matched; selected OpenClaw default model"
        }
    }
    if ($fallbacks) {
        return [pscustomobject]@{
            model = ($fallbacks | Select-Object -First 1)
            reason = "no default model available; selected first OpenClaw fallback model"
        }
    }
    if ($allModels) {
        return [pscustomobject]@{
            model = ($allModels | Select-Object -First 1)
            reason = "no default or fallback model available; selected first allowed model"
        }
    }

    return [pscustomobject]@{
        model = ""
        reason = "no model information available; omitted --model so OpenClaw decides"
    }
}

try {
    $ResolvedExpertFile = Resolve-ExpertFile -Name $ExpertName -Path $ExpertFile
    $modelChoice = Get-ModelChoice -Name $ExpertName -ExplicitModel $Model
    $SelectedModel = [string]$modelChoice.model
    $ModelSelectionReason = [string]$modelChoice.reason

    $safeExpertName = ConvertTo-SafeId -Value $ExpertName
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ([string]::IsNullOrWhiteSpace($BatchId)) {
        $AgentId = "temp-$safeExpertName-$timestamp"
    } else {
        $safeBatchId = ConvertTo-SafeId -Value $BatchId
        $AgentId = "temp-$safeBatchId-$safeExpertName-$timestamp"
    }

    $tempRoot = Join-Path $env:USERPROFILE ".openclaw\temp"
    $WorkspaceDir = Join-Path $tempRoot $AgentId
    $AgentDir = Join-Path (Join-Path $env:USERPROFILE ".openclaw\agents\$AgentId") "agent"
    New-Item -ItemType Directory -Path $WorkspaceDir -Force | Out-Null
    New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null

    Copy-Item -LiteralPath $ResolvedExpertFile -Destination (Join-Path $WorkspaceDir "AGENTS.md") -Force

    $identity = @"
# $ExpertName (Temporary Instance)
emoji: agent
description: Temporary expert agent created by Master Orchestrator
model: $SelectedModel
"@
    $identity | Out-File -LiteralPath (Join-Path $WorkspaceDir "IDENTITY.md") -Encoding utf8

    $soul = @"
You are a temporary agent created from an agency-agents expert definition.
Your role and responsibilities are stored in AGENTS.md.
Complete only the task assigned by the Master Orchestrator.
"@
    $soul | Out-File -LiteralPath (Join-Path $WorkspaceDir "SOUL.md") -Encoding utf8

    $addArgs = @(
        "agents", "add", $AgentId,
        "--workspace", $WorkspaceDir,
        "--agent-dir", $AgentDir,
        "--non-interactive",
        "--json"
    )
    if (-not [string]::IsNullOrWhiteSpace($SelectedModel)) {
        $addArgs += @("--model", $SelectedModel)
    }

    $result = & openclaw $addArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Remove-Item -LiteralPath $WorkspaceDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Split-Path -Parent $AgentDir) -Recurse -Force -ErrorAction SilentlyContinue
        throw "OpenClaw agent registration failed: $result"
    }

    $output = [ordered]@{
        agentId = $AgentId
        expertName = $ExpertName
        model = $SelectedModel
        modelSelectionReason = $ModelSelectionReason
        workspace = $WorkspaceDir
        agentDir = $AgentDir
        expertFile = $ResolvedExpertFile
        batchId = $BatchId
    }
    Write-Output ($output | ConvertTo-Json -Compress)
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
