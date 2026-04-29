<#
.SYNOPSIS
  Delete one temporary OpenClaw agent created by create_temp_expert.ps1.
.DESCRIPTION
  Safety rules:
  - AgentId must match the temp-* naming convention.
  - Workspace deletion is restricted to ~/.openclaw/temp/<AgentId>.
  - Agent state deletion is restricted to ~/.openclaw/agents/<AgentId>.
  - The script continues local cleanup even if OpenClaw deletion warns.
.PARAMETER AgentId
  Temporary agent id, for example temp-frontend-developer-1713992400000.
.OUTPUTS
  JSON summary.
.EXAMPLE
  .\cleanup_temp.ps1 -AgentId "temp-frontend-developer-1713992400000"
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^temp-[A-Za-z0-9._-]+-\d{10,}$')]
    [string]$AgentId
)

$ErrorActionPreference = "Stop"

try {
    $tempRoot = Join-Path $env:USERPROFILE ".openclaw\temp"
    $agentsRoot = Join-Path $env:USERPROFILE ".openclaw\agents"
    $workspaceDir = Join-Path $tempRoot $AgentId
    $agentStateDir = Join-Path $agentsRoot $AgentId
    $removedWorkspace = $false
    $removedAgentState = $false

    $deleteResult = & openclaw agents delete $AgentId --force --json 2>&1
    $openclawDeleted = ($LASTEXITCODE -eq 0)
    if (-not $openclawDeleted) {
        Write-Warning "OpenClaw deletion returned a non-zero exit code: $deleteResult"
    }

    if (Test-Path -LiteralPath $workspaceDir) {
        $resolvedTempRoot = (Resolve-Path -LiteralPath $tempRoot).Path.TrimEnd('\')
        $resolvedWorkspace = (Resolve-Path -LiteralPath $workspaceDir).Path
        if (-not $resolvedWorkspace.StartsWith($resolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove workspace outside temp root: $resolvedWorkspace"
        }

        Remove-Item -LiteralPath $resolvedWorkspace -Recurse -Force
        $removedWorkspace = -not (Test-Path -LiteralPath $resolvedWorkspace)
    }

    if (Test-Path -LiteralPath $agentStateDir) {
        $resolvedAgentsRoot = (Resolve-Path -LiteralPath $agentsRoot).Path.TrimEnd('\')
        $resolvedAgentState = (Resolve-Path -LiteralPath $agentStateDir).Path
        if (-not $resolvedAgentState.StartsWith($resolvedAgentsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove agent state outside agents root: $resolvedAgentState"
        }

        Remove-Item -LiteralPath $resolvedAgentState -Recurse -Force
        $removedAgentState = -not (Test-Path -LiteralPath $resolvedAgentState)
    }

    $output = [ordered]@{
        agentId = $AgentId
        openclawDeleted = $openclawDeleted
        workspace = $workspaceDir
        workspaceRemoved = $removedWorkspace
        agentState = $agentStateDir
        agentStateRemoved = $removedAgentState
    }
    Write-Output ($output | ConvertTo-Json -Compress)
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
