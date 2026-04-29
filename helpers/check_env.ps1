<#
.SYNOPSIS
  Inspect the local OpenClaw + Master Orchestrator environment.
.DESCRIPTION
  Phase 0 helper. Returns JSON describing available experts, templates,
  OpenClaw agents, and model status. It is intentionally read-only.
.PARAMETER AgencyRoot
  Optional agency-agents root. Defaults to ~/.openclaw/agency-agents.
.PARAMETER TemplatesDir
  Optional templates directory. Defaults to repo-root/templates.
.PARAMETER ExpertPreviewLimit
  Number of experts to include in the preview list. Full count is always returned.
.PARAMETER OpenClawTimeoutSeconds
  Timeout for each OpenClaw status command. Timed-out commands are reported in JSON.
.OUTPUTS
  JSON summary.
.EXAMPLE
  .\check_env.ps1
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$AgencyRoot = "",

    [Parameter(Mandatory = $false)]
    [string]$TemplatesDir = "",

    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 500)]
    [int]$ExpertPreviewLimit = 80,

    [Parameter(Mandatory = $false)]
    [ValidateRange(3, 120)]
    [int]$OpenClawTimeoutSeconds = 12
)

$ErrorActionPreference = "Stop"

function Invoke-OpenClawJson {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds
    )

    $job = $null
    try {
        $job = Start-Job -ScriptBlock {
            param([string[]]$InnerArguments)
            $lines = & openclaw @InnerArguments 2>&1
            $safeLines = @($lines | ForEach-Object { $_.ToString() })
            [ordered]@{
                exitCode = $LASTEXITCODE
                lines = $safeLines
            } | ConvertTo-Json -Depth 6 -Compress
        } -ArgumentList (,$Arguments)

        $done = Wait-Job -Job $job -Timeout $TimeoutSeconds
        if (-not $done) {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            return [ordered]@{
                ok = $false
                data = $null
                error = "Timed out after $TimeoutSeconds seconds: openclaw $($Arguments -join ' ')"
            }
        }

        $jobJson = Receive-Job -Job $job
        $result = ($jobJson | Select-Object -Last 1) | ConvertFrom-Json
        $stdout = @($result.lines)
        if ($result.exitCode -ne 0) {
            return [ordered]@{
                ok = $false
                data = $null
                error = ($stdout -join "`n")
            }
        }

        $data = $null
        try {
            $data = ($stdout | Select-Object -Last 1) | ConvertFrom-Json
        } catch {
            $data = $stdout
        }

        return [ordered]@{
            ok = $true
            data = $data
            error = ""
        }
    } catch {
        return [ordered]@{
            ok = $false
            data = $null
            error = $_.Exception.Message
        }
    } finally {
        if ($job) {
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-ExpertSummary {
    param([Parameter(Mandatory = $true)][string]$AgentFile)

    try {
        $lines = Get-Content -Encoding UTF8 -LiteralPath $AgentFile -TotalCount 30
        $title = ($lines | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -First 1)
        $summary = ($lines | Where-Object {
            $t = $_.Trim()
            $t.Length -gt 0 -and -not $t.StartsWith("#") -and -not $t.StartsWith("---")
        } | Select-Object -First 1)

        return [ordered]@{
            title = if ($title) { $title.Trim() } else { "" }
            summary = if ($summary) { $summary.Trim() } else { "" }
        }
    } catch {
        return [ordered]@{
            title = ""
            summary = ""
        }
    }
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($AgencyRoot)) {
        $AgencyRoot = Join-Path $env:USERPROFILE ".openclaw\agency-agents"
    }
    if ([string]::IsNullOrWhiteSpace($TemplatesDir)) {
        $TemplatesDir = Join-Path $repoRoot "templates"
    }

    $experts = New-Object System.Collections.Generic.List[object]
    $agencyExists = Test-Path -LiteralPath $AgencyRoot -PathType Container
    if ($agencyExists) {
        Get-ChildItem -LiteralPath $AgencyRoot -Directory | Sort-Object Name | ForEach-Object {
            $agentFile = Join-Path $_.FullName "AGENTS.md"
            $hasAgentFile = Test-Path -LiteralPath $agentFile -PathType Leaf
            $summary = if ($hasAgentFile) { Get-ExpertSummary -AgentFile $agentFile } else { [ordered]@{ title = ""; summary = "" } }
            $experts.Add([ordered]@{
                name = $_.Name
                path = $_.FullName
                agentFile = $agentFile
                hasAgentFile = $hasAgentFile
                title = $summary.title
                summary = $summary.summary
            }) | Out-Null
        }
    }

    $templates = New-Object System.Collections.Generic.List[object]
    $templatesExist = Test-Path -LiteralPath $TemplatesDir -PathType Container
    if ($templatesExist) {
        Get-ChildItem -LiteralPath $TemplatesDir -Filter *.json -File | Sort-Object Name | ForEach-Object {
            $templateName = [IO.Path]::GetFileNameWithoutExtension($_.Name)
            $agentCount = 0
            $validJson = $false
            try {
                $template = Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName | ConvertFrom-Json
                $validJson = $true
                $agentCount = @($template.agents).Count
                if ($template.name) {
                    $templateName = [string]$template.name
                }
            } catch {
                $validJson = $false
            }

            $templates.Add([ordered]@{
                name = $templateName
                file = $_.FullName
                validJson = $validJson
                agentCount = $agentCount
            }) | Out-Null
        }
    }

    $models = Invoke-OpenClawJson -Arguments @("models", "status", "--json") -TimeoutSeconds $OpenClawTimeoutSeconds
    $agents = Invoke-OpenClawJson -Arguments @("agents", "list", "--json") -TimeoutSeconds $OpenClawTimeoutSeconds

    $recommendedPlugins = New-Object System.Collections.Generic.List[string]
    if ($experts.Count -gt 0) {
        $recommendedPlugins.Add("agency") | Out-Null
    }
    if ($templates.Count -gt 0) {
        $recommendedPlugins.Add("agency-pack") | Out-Null
    }

    $expertPreview = @($experts.ToArray() | Select-Object -First $ExpertPreviewLimit)
    $templateItems = @($templates.ToArray())

    $output = [ordered]@{
        generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
        repoRoot = $repoRoot
        openclaw = [ordered]@{
            models = $models
            agents = $agents
        }
        agency = [ordered]@{
            root = $AgencyRoot
            exists = $agencyExists
            expertCount = $experts.Count
            experts = $expertPreview
        }
        templates = [ordered]@{
            root = $TemplatesDir
            exists = $templatesExist
            templateCount = $templates.Count
            items = $templateItems
        }
        recommendedPlugins = @($recommendedPlugins)
    }

    Write-Output ($output | ConvertTo-Json -Depth 8 -Compress)
} catch {
    $message = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = ($_ | Out-String)
    }
    if ($_.ScriptStackTrace) {
        $message = "$message`n$($_.ScriptStackTrace)"
    }
    Write-Error $message
    exit 1
}
