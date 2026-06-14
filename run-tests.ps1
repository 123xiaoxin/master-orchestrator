<#
.SYNOPSIS
  Run the complete Master Orchestrator Pester suite.
.PARAMETER OutputFile
  Optional NUnit XML output path.
.PARAMETER PassThru
  Return the Pester result object instead of exiting with a status code.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$OutputFile = "",

    [Parameter(Mandatory = $false)]
    [switch]$PassThru
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$testsRoot = Join-Path $repoRoot "tests"

$pester = Get-Module -Name Pester -ListAvailable |
    Where-Object { $_.Version -ge [version]"5.4.1" } |
    Sort-Object Version -Descending |
    Select-Object -First 1

if (-not $pester) {
    throw "Pester 5.4.1 or newer is required. Install it with: Install-Module Pester -Scope CurrentUser -RequiredVersion 5.4.1"
}

Import-Module Pester -MinimumVersion 5.4.1

if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $OutputFile = Join-Path $repoRoot "test-results.xml"
}

$config = New-PesterConfiguration
$config.Run.Path = $testsRoot
$config.Run.Exit = $false
$config.Run.PassThru = $true
$config.Output.Verbosity = "Detailed"
$config.TestResult.Enabled = $true
$config.TestResult.OutputFormat = "NUnitXml"
$config.TestResult.OutputPath = $OutputFile

$result = Invoke-Pester -Configuration $config

if ($PassThru) {
    Write-Output $result
    return
}

if ($result.FailedCount -gt 0) {
    exit 1
}
exit 0
