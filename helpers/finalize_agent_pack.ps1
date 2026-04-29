<#
.SYNOPSIS
  Finalize a temporary agent pack.
.DESCRIPTION
  Supports three lifecycle actions:
  - destroy: delete temporary agents and workspaces
  - keep: leave temporary agents registered for follow-up work
  - archive-template: write a reusable clean template from the runtime manifest
.PARAMETER ManifestFile
  Path to ~/.openclaw/temp/packs/<PackId>/manifest.json.
.PARAMETER PackId
  Pack id to resolve under ~/.openclaw/temp/packs/<PackId>/manifest.json.
.PARAMETER Action
  destroy, keep, or archive-template.
.PARAMETER TemplateOutDir
  Output directory for archive-template. Defaults to repo templates/generated.
.OUTPUTS
  JSON summary.
.EXAMPLE
  .\finalize_agent_pack.ps1 -PackId webapp-build-1713992400000 -Action destroy
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$ManifestFile = "",

    [Parameter(Mandatory = $false)]
    [ValidatePattern('^[A-Za-z0-9._-]*$')]
    [string]$PackId = "",

    [Parameter(Mandatory = $true)]
    [ValidateSet("destroy", "keep", "archive-template")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [string]$TemplateOutDir = ""
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

function ConvertTo-Array {
    param($Value)
    if ($null -eq $Value) {
        return [object[]]@()
    }
    return [object[]]@($Value)
}

try {
    if ([string]::IsNullOrWhiteSpace($ManifestFile)) {
        if ([string]::IsNullOrWhiteSpace($PackId)) {
            throw "Provide either -ManifestFile or -PackId."
        }
        $ManifestFile = Join-Path (Join-Path $env:USERPROFILE ".openclaw\temp\packs\$PackId") "manifest.json"
    }

    $resolvedManifest = (Resolve-Path -LiteralPath $ManifestFile).Path
    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolvedManifest | ConvertFrom-Json
    $cleanupScript = Join-Path $PSScriptRoot "cleanup_temp.ps1"
    $results = New-Object System.Collections.Generic.List[object]
    $templateFile = ""

    if ($Action -eq "destroy") {
        foreach ($agent in @($manifest.agents)) {
            try {
                $raw = & $cleanupScript -AgentId $agent.agentId
                $summary = ($raw | Select-Object -Last 1) | ConvertFrom-Json
                $results.Add($summary) | Out-Null
            } catch {
                $results.Add([ordered]@{
                    agentId = $agent.agentId
                    error = $_.Exception.Message
                }) | Out-Null
            }
        }
    } elseif ($Action -eq "archive-template") {
        $repoRoot = Split-Path -Parent $PSScriptRoot
        if ([string]::IsNullOrWhiteSpace($TemplateOutDir)) {
            $TemplateOutDir = Join-Path (Join-Path $repoRoot "templates") "generated"
        }
        New-Item -ItemType Directory -Path $TemplateOutDir -Force | Out-Null
        $templateName = ConvertTo-SafeId -Value $manifest.name
        $templateFile = Join-Path $TemplateOutDir "$templateName.json"

        $templateAgents = @($manifest.agents) | ForEach-Object {
            [ordered]@{
                name = $_.name
                role = $_.role
                dependsOn = @(ConvertTo-Array -Value $_.dependsOn)
            }
        }

        $template = [ordered]@{
            name = $manifest.name
            description = $manifest.description
            maxAgents = [Math]::Min(5, @($manifest.agents).Count)
            execution = $manifest.execution
            cleanupPolicy = "ask"
            agents = @($templateAgents)
        }
        $template | ConvertTo-Json -Depth 8 | Out-File -LiteralPath $templateFile -Encoding utf8
    }

    $manifest | Add-Member -NotePropertyName finalizedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString("o")) -Force
    $manifest | Add-Member -NotePropertyName finalizeAction -NotePropertyValue $Action -Force
    $manifest | ConvertTo-Json -Depth 8 | Out-File -LiteralPath $resolvedManifest -Encoding utf8

    $output = [ordered]@{
        action = $Action
        manifest = $resolvedManifest
        template = $templateFile
        results = @($results)
    }
    Write-Output ($output | ConvertTo-Json -Depth 8 -Compress)
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
