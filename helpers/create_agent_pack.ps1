<#
.SYNOPSIS
  Create 1-5 temporary OpenClaw agents from an agent-pack template.
.DESCRIPTION
  Templates live under templates/*.json and reference expert names from
  ~/.openclaw/agency-agents/<ExpertName>/AGENTS.md. The script creates a
  runtime manifest under ~/.openclaw/temp/packs/<PackId>/manifest.json.
.PARAMETER TemplateFile
  Path to an agent-pack JSON template.
.PARAMETER PackId
  Optional pack id. When omitted, the template name plus a timestamp is used.
.PARAMETER MaxAgents
  Maximum allowed number of temporary agents. Defaults to 5.
.PARAMETER Model
  Optional model override passed to every created expert.
.PARAMETER TaskTitle
  Optional human-readable task title recorded into the runtime manifest.
.PARAMETER ExecutionMode
  User-confirmed execution mode recorded into the runtime manifest.
.PARAMETER SuccessCriteria
  One or more physical success criteria from task_analysis.v1.
.PARAMETER UserConfirmed
  Records that the user explicitly confirmed the deployment plan before spawn.
.PARAMETER KeepOnFailure
  Keep already-created agents if a later agent fails to create.
.PARAMETER DryRun
  Print the planned pack without creating OpenClaw agents or writing a manifest.
.OUTPUTS
  JSON manifest summary.
.EXAMPLE
  .\create_agent_pack.ps1 -TemplateFile ..\templates\webapp-build.json
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$TemplateFile,

    [Parameter(Mandatory = $false)]
    [ValidatePattern('^[A-Za-z0-9._-]*$')]
    [string]$PackId = "",

    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 5)]
    [int]$MaxAgents = 5,

    [Parameter(Mandatory = $false)]
    [string]$Model = "",

    [Parameter(Mandatory = $false)]
    [string]$TaskTitle = "",

    [Parameter(Mandatory = $false)]
    [ValidateSet("unspecified", "step-by-step", "expert-hosted")]
    [string]$ExecutionMode = "unspecified",

    [Parameter(Mandatory = $false)]
    [string[]]$SuccessCriteria = @(),

    [Parameter(Mandatory = $false)]
    [switch]$UserConfirmed,

    [Parameter(Mandatory = $false)]
    [switch]$KeepOnFailure,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
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

function Get-AgentName {
    param([Parameter(Mandatory = $true)]$AgentSpec)
    if ($AgentSpec -is [string]) {
        return $AgentSpec
    }
    if ($AgentSpec.PSObject.Properties.Name -contains "name") {
        return [string]$AgentSpec.name
    }
    throw "Each template agent must be a string or an object with a name field."
}

function Get-DependsOn {
    param([Parameter(Mandatory = $true)]$AgentSpec)
    if ($AgentSpec -is [string]) {
        return [object[]]@()
    }
    if (-not ($AgentSpec.PSObject.Properties.Name -contains "dependsOn")) {
        return [object[]]@()
    }
    if ($null -eq $AgentSpec.dependsOn) {
        return [object[]]@()
    }
    return [object[]]@($AgentSpec.dependsOn)
}

function Has-Property {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-MicroSop {
    param([Parameter(Mandatory = $true)]$AgentSpec)

    $defaultBudget = [ordered]@{
        tokenBudget = $null
        maxRounds = $null
        timeoutMinutes = $null
        heartbeat = 0
    }

    if ($AgentSpec -is [string]) {
        return [ordered]@{
            schemaVersion = "micro_sop.v1"
            context = ""
            deliverable = ""
            negativeConstraints = @()
            exitCondition = ""
            budget = $defaultBudget
        }
    }

    if ($AgentSpec.PSObject.Properties.Name -contains "microSop") {
        return $AgentSpec.microSop
    }

    return [ordered]@{
        schemaVersion = "micro_sop.v1"
        context = ""
        deliverable = ""
        negativeConstraints = @()
        exitCondition = ""
        budget = $defaultBudget
    }
}

function Test-MicroSopSpec {
    param(
        [Parameter(Mandatory = $true)]$AgentSpec,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($AgentSpec -is [string]) {
        throw "Template agent '$Name' must use object form with a microSop in v5.4."
    }
    if (-not (Has-Property -Object $AgentSpec -Name "microSop")) {
        throw "Template agent '$Name' must define microSop."
    }

    $microSop = $AgentSpec.microSop
    if (-not (Has-Property -Object $microSop -Name "schemaVersion") -or $microSop.schemaVersion -ne "micro_sop.v1") {
        throw "Template agent '$Name' microSop.schemaVersion must be micro_sop.v1."
    }
    foreach ($field in @("context", "deliverable", "exitCondition")) {
        if (-not (Has-Property -Object $microSop -Name $field) -or [string]::IsNullOrWhiteSpace([string]$microSop.$field)) {
            throw "Template agent '$Name' microSop.$field must be a non-empty string."
        }
    }
    if (-not (Has-Property -Object $microSop -Name "negativeConstraints") -or @($microSop.negativeConstraints).Count -lt 1) {
        throw "Template agent '$Name' microSop.negativeConstraints must contain at least one item."
    }
    if (-not (Has-Property -Object $microSop -Name "budget") -or -not (Has-Property -Object $microSop.budget -Name "heartbeat") -or [int]$microSop.budget.heartbeat -ne 0) {
        throw "Template agent '$Name' microSop.budget.heartbeat must be 0."
    }
}

function Get-ExpertDefinitionPath {
    param([Parameter(Mandatory = $true)][string]$Name)
    $agencyRoot = Join-Path $env:USERPROFILE ".openclaw\agency-agents"
    return (Join-Path (Join-Path $agencyRoot $Name) "AGENTS.md")
}

function Test-DependencyCycle {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Graph,
        [Parameter(Mandatory = $true)][string[]]$Names
    )

    $visiting = @{}
    $visited = @{}

    function Visit-Node {
        param([Parameter(Mandatory = $true)][string]$Name)

        if ($visiting.ContainsKey($Name)) {
            throw "Template contains a dependency cycle at '$Name'."
        }
        if ($visited.ContainsKey($Name)) {
            return
        }

        $visiting[$Name] = $true
        foreach ($dep in @($Graph[$Name])) {
            Visit-Node -Name $dep
        }
        $visiting.Remove($Name)
        $visited[$Name] = $true
    }

    foreach ($name in $Names) {
        Visit-Node -Name $name
    }
}

function Validate-AgentPack {
    param(
        [Parameter(Mandatory = $true)][object[]]$TemplateAgents,
        [Parameter(Mandatory = $true)][int]$MaxAgents
    )

    if ($TemplateAgents.Count -lt 1) {
        throw "Template must define at least one agent."
    }
    if ($TemplateAgents.Count -gt $MaxAgents) {
        throw "Template defines $($TemplateAgents.Count) agents, but MaxAgents is $MaxAgents."
    }

    $names = New-Object System.Collections.Generic.List[string]
    $nameSet = @{}
    $graph = @{}
    $expertFiles = @{}

    foreach ($agentSpec in $TemplateAgents) {
        $name = Get-AgentName -AgentSpec $agentSpec
        if ([string]::IsNullOrWhiteSpace($name)) {
            throw "Template contains an empty agent name."
        }
        if ($name -notmatch '^[A-Za-z0-9._-]+$') {
            throw "Template agent name '$name' contains unsupported characters."
        }
        if ($nameSet.ContainsKey($name)) {
            throw "Template contains duplicate agent '$name'."
        }

        $expertFile = Get-ExpertDefinitionPath -Name $name
        if (-not (Test-Path -LiteralPath $expertFile -PathType Leaf)) {
            throw "Expert '$name' does not exist at expected path: $expertFile"
        }

        $nameSet[$name] = $true
        $names.Add($name) | Out-Null
        $expertFiles[$name] = $expertFile
    }

    foreach ($agentSpec in $TemplateAgents) {
        $name = Get-AgentName -AgentSpec $agentSpec
        $deps = @(Get-DependsOn -AgentSpec $agentSpec)
        foreach ($dep in $deps) {
            if ([string]::IsNullOrWhiteSpace([string]$dep)) {
                throw "Agent '$name' has an empty dependsOn entry."
            }
            if ($dep -eq $name) {
                throw "Agent '$name' cannot depend on itself."
            }
            if (-not $nameSet.ContainsKey($dep)) {
                throw "Agent '$name' depends on '$dep', but '$dep' is not listed in template agents."
            }
        }
        $graph[$name] = $deps
        Test-MicroSopSpec -AgentSpec $agentSpec -Name $name
    }

    Test-DependencyCycle -Graph $graph -Names ([string[]]$names.ToArray())

    return [ordered]@{
        ok = $true
        agentCount = $names.Count
        agents = @($names)
        expertFiles = $expertFiles
    }
}

try {
    $resolvedTemplate = (Resolve-Path -LiteralPath $TemplateFile).Path
    $template = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolvedTemplate | ConvertFrom-Json
    $agents = @($template.agents)
    $validation = Validate-AgentPack -TemplateAgents $agents -MaxAgents $MaxAgents

    if ([string]::IsNullOrWhiteSpace($PackId)) {
        $baseName = if ($template.name) { [string]$template.name } else { [IO.Path]::GetFileNameWithoutExtension($resolvedTemplate) }
        $PackId = "$(ConvertTo-SafeId -Value $baseName)-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    }

    if ($DryRun) {
        $agencyRoot = Join-Path $env:USERPROFILE ".openclaw\agency-agents"
        $planned = @($agents) | ForEach-Object {
            $expertName = Get-AgentName -AgentSpec $_
            [ordered]@{
                name = $expertName
                expertFile = Get-ExpertDefinitionPath -Name $expertName
                role = if (($_ -isnot [string]) -and ($_.PSObject.Properties.Name -contains "role")) { [string]$_.role } else { "" }
                dependsOn = @(Get-DependsOn -AgentSpec $_)
                microSop = Get-MicroSop -AgentSpec $_
            }
        }

        $preview = [ordered]@{
            dryRun = $true
            packId = $PackId
            name = if ($template.name) { [string]$template.name } else { [IO.Path]::GetFileNameWithoutExtension($resolvedTemplate) }
            taskTitle = $TaskTitle
            executionMode = $ExecutionMode
            userConfirmed = [bool]$UserConfirmed
            successCriteria = @($SuccessCriteria)
            sourceTemplate = $resolvedTemplate
            agentCount = $planned.Count
            validation = $validation
            agents = @($planned)
        }
        Write-Output ($preview | ConvertTo-Json -Depth 8 -Compress)
        exit 0
    }

    $repoRoot = Split-Path -Parent $PSScriptRoot
    $createScript = Join-Path $PSScriptRoot "create_temp_expert.ps1"
    $cleanupScript = Join-Path $PSScriptRoot "cleanup_temp.ps1"
    $packRoot = Join-Path (Join-Path $env:USERPROFILE ".openclaw\temp\packs") $PackId
    New-Item -ItemType Directory -Path $packRoot -Force | Out-Null

    $created = New-Object System.Collections.Generic.List[object]

    foreach ($agentSpec in $agents) {
        $expertName = Get-AgentName -AgentSpec $agentSpec
        if ([string]::IsNullOrWhiteSpace($expertName)) {
            throw "Template contains an empty agent name."
        }

        $agentModel = $Model
        if ([string]::IsNullOrWhiteSpace($agentModel) -and -not ($agentSpec -is [string]) -and ($agentSpec.PSObject.Properties.Name -contains "model")) {
            $agentModel = [string]$agentSpec.model
        }

        $args = @("-ExpertName", $expertName, "-BatchId", $PackId)
        if (-not [string]::IsNullOrWhiteSpace($agentModel)) {
            $args += @("-Model", $agentModel)
        }

        Write-Host "Creating temporary expert: $expertName"
        $raw = & $createScript @args
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create expert: $expertName"
        }

        $createdAgent = ($raw | Select-Object -Last 1) | ConvertFrom-Json
        $created.Add([ordered]@{
            name = $expertName
            agentId = $createdAgent.agentId
            model = $createdAgent.model
            modelSelectionReason = $createdAgent.modelSelectionReason
            workspace = $createdAgent.workspace
            agentDir = $createdAgent.agentDir
            expertFile = $createdAgent.expertFile
            role = if (($agentSpec -isnot [string]) -and ($agentSpec.PSObject.Properties.Name -contains "role")) { [string]$agentSpec.role } else { "" }
            dependsOn = @(Get-DependsOn -AgentSpec $agentSpec)
            microSop = Get-MicroSop -AgentSpec $agentSpec
        }) | Out-Null
    }

    $confirmedAt = ""
    if ($UserConfirmed) {
        $confirmedAt = [DateTimeOffset]::UtcNow.ToString("o")
    }

    $manifest = [ordered]@{
        packId = $PackId
        name = if ($template.name) { [string]$template.name } else { [IO.Path]::GetFileNameWithoutExtension($resolvedTemplate) }
        description = if ($template.description) { [string]$template.description } else { "" }
        sourceTemplate = $resolvedTemplate
        createdAt = [DateTimeOffset]::UtcNow.ToString("o")
        taskTitle = $TaskTitle
        executionContract = [ordered]@{
            schemaVersion = "task_analysis.v1"
            executionMode = $ExecutionMode
            successCriteria = @($SuccessCriteria)
            userConfirmed = [bool]$UserConfirmed
            confirmedAt = $confirmedAt
        }
        maxAgents = $MaxAgents
        execution = if ($template.execution) { $template.execution } else { "" }
        cleanupPolicy = if ($template.cleanupPolicy) { [string]$template.cleanupPolicy } else { "ask" }
        lifecycle = [ordered]@{
            status = "created"
            finalizeAction = ""
            finalizedAt = ""
        }
        validation = $validation
        agents = @($created)
    }

    $manifestFile = Join-Path $packRoot "manifest.json"
    $manifest | ConvertTo-Json -Depth 8 | Out-File -LiteralPath $manifestFile -Encoding utf8

    $output = [ordered]@{
        packId = $PackId
        manifest = $manifestFile
        agents = @($created)
    }
    Write-Output ($output | ConvertTo-Json -Depth 8 -Compress)
} catch {
    if (-not $KeepOnFailure -and $created -and $created.Count -gt 0) {
        foreach ($item in $created) {
            try {
                & $cleanupScript -AgentId $item.agentId | Out-Null
            } catch {
                Write-Warning "Cleanup after failure did not complete for $($item.agentId): $($_.Exception.Message)"
            }
        }
    }
    Write-Error $_.Exception.Message
    exit 1
}
