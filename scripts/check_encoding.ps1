<#
.SYNOPSIS
  Check repository text files for UTF-8 without BOM and prompt filename safety.
.DESCRIPTION
  v5.4 guardrail: prompt filenames must be ASCII-only, and tracked text files
  under prompts, schemas, examples, helpers, scripts, evals, and templates must
  decode as UTF-8 without a byte-order mark.
.PARAMETER Path
  Repository root. Defaults to the parent directory of this script.
.PARAMETER Json
  Emit a machine-readable JSON result.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Path = "",

    [Parameter(Mandatory = $false)]
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Add-Issue {
    param(
        [System.Collections.Generic.List[object]]$Issues,
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $Issues.Add([ordered]@{
        file = $File
        message = $Message
    }) | Out-Null
}

try {
    if ([string]::IsNullOrWhiteSpace($Path)) {
        $Path = Split-Path -Parent $PSScriptRoot
    }
    $root = (Resolve-Path -LiteralPath $Path).Path
    $issues = New-Object System.Collections.Generic.List[object]
    $checked = 0

    $relativeRoots = @("prompts", "schemas", "examples", "helpers", "scripts", "evals", "templates")
    $extensions = @(".md", ".json", ".ps1")
    $utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)

    foreach ($relativeRoot in $relativeRoots) {
        $dir = Join-Path $root $relativeRoot
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
            continue
        }

        Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object {
            $extensions -contains $_.Extension.ToLowerInvariant()
        } | ForEach-Object {
            $checked += 1
            $relative = $_.FullName.Substring($root.Length).TrimStart('\', '/')
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)

            if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
                Add-Issue -Issues $issues -File $relative -Message "File has UTF-8 BOM."
            }

            try {
                $null = $utf8Strict.GetString($bytes)
            } catch {
                Add-Issue -Issues $issues -File $relative -Message "File is not valid UTF-8."
            }

            if ($relativeRoot -eq "prompts") {
                $fileName = [System.IO.Path]::GetFileName($_.Name)
                if ($fileName -match '[^\x00-\x7F]') {
                    Add-Issue -Issues $issues -File $relative -Message "Prompt filename must be ASCII-only."
                }
            }
        }
    }

    $result = [ordered]@{
        ok = ($issues.Count -eq 0)
        checked = $checked
        issueCount = $issues.Count
        issues = @($issues.ToArray())
    }

    if ($Json) {
        Write-Output ($result | ConvertTo-Json -Depth 6 -Compress)
    } elseif ($issues.Count -eq 0) {
        Write-Output "OK encoding check passed for $checked files."
    } else {
        foreach ($issue in $issues) {
            Write-Output "FAIL $($issue.file): $($issue.message)"
        }
    }

    if ($issues.Count -gt 0) {
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
