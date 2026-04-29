<#
.SYNOPSIS
  Validate all Agent Pack templates.
.DESCRIPTION
  Recursively finds templates/*.json and validates them by invoking
  create_agent_pack.ps1 -DryRun. This checks JSON parsing, expert existence,
  agent count, dependency references, self-dependencies, and cycles.
.PARAMETER TemplatesRoot
  Optional templates root. Defaults to repo-root/templates.
.OUTPUTS
  JSON validation summary.
.EXAMPLE
  .\validate_templates.ps1
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$TemplatesRoot = ""
)

$ErrorActionPreference = "Stop"

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($TemplatesRoot)) {
        $TemplatesRoot = Join-Path $repoRoot "templates"
    }

    $createPack = Join-Path $PSScriptRoot "create_agent_pack.ps1"
    $resolvedRoot = (Resolve-Path -LiteralPath $TemplatesRoot).Path
    $results = New-Object System.Collections.Generic.List[object]
    $failed = 0

    Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Filter *.json -File | Sort-Object FullName | ForEach-Object {
        $relative = $_.FullName.Substring($resolvedRoot.Length).TrimStart('\', '/')
        try {
            $raw = & $createPack -TemplateFile $_.FullName -DryRun
            if ($LASTEXITCODE -ne 0) {
                throw "create_agent_pack.ps1 returned exit code $LASTEXITCODE"
            }
            $preview = ($raw | Select-Object -Last 1) | ConvertFrom-Json
            $results.Add([ordered]@{
                file = $relative
                ok = $true
                name = $preview.name
                agentCount = $preview.agentCount
                validationOk = $preview.validation.ok
                error = ""
            }) | Out-Null
        } catch {
            $failed += 1
            $results.Add([ordered]@{
                file = $relative
                ok = $false
                name = ""
                agentCount = 0
                validationOk = $false
                error = $_.Exception.Message
            }) | Out-Null
        }
    }

    $summary = [ordered]@{
        generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
        templatesRoot = $resolvedRoot
        total = $results.Count
        failed = $failed
        ok = ($failed -eq 0)
        results = @($results.ToArray())
    }

    Write-Output ($summary | ConvertTo-Json -Depth 8 -Compress)
    if ($failed -gt 0) {
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
