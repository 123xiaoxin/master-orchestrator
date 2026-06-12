function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function New-TestSandbox {
    $path = Join-Path ([System.IO.Path]::GetTempPath()) ("master-orchestrator-tests-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    return $path
}

function New-TestExpert {
    param(
        [Parameter(Mandatory = $true)][string]$AgencyRoot,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $expertDir = Join-Path $AgencyRoot $Name
    New-Item -ItemType Directory -Force -Path $expertDir | Out-Null
    Write-Utf8NoBom -Path (Join-Path $expertDir "AGENTS.md") -Content "# $Name`n"
}

function New-TestAgentPackTemplate {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpertName
    )

    $template = [ordered]@{
        schemaVersion = "agent_pack.v1"
        name = "portable-test-pack"
        description = "Portable validation fixture"
        maxAgents = 1
        execution = "serial"
        cleanupPolicy = "destroy"
        agents = @(
            [ordered]@{
                name = $ExpertName
                role = "Validate injected expert root"
                dependsOn = @()
                microSop = [ordered]@{
                    schemaVersion = "micro_sop.v1"
                    context = "Read the fixture."
                    deliverable = "Return the validation result."
                    negativeConstraints = @("Do not write outside the sandbox.")
                    exitCondition = "Validation result is available."
                    budget = [ordered]@{
                        tokenBudget = $null
                        maxRounds = 1
                        timeoutMinutes = 5
                        heartbeat = 0
                    }
                }
            }
        )
    }

    Write-Utf8NoBom -Path $Path -Content ($template | ConvertTo-Json -Depth 10)
}
