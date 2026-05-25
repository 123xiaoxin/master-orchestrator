<#
.SYNOPSIS
  Run offline LLM behavior evals against an OpenAI-compatible chat endpoint.
.DESCRIPTION
  This runner reads eval case JSON files, sends each case input to a configured
  model with the Master prompt, saves model outputs under evals/results/, and
  checks mustContain / mustContainAny / mustNotContain assertions. It never
  executes model output, never creates Agents, and never calls OpenClaw actions.
.PARAMETER CasesDir
  Directory containing eval case JSON files.
.PARAMETER ResultsDir
  Directory where model outputs and summary reports are written.
.PARAMETER PromptFile
  Master prompt file to use as the system prompt.
.PARAMETER BaseUrl
  OpenAI-compatible API base URL. Defaults to MASTER_EVAL_BASE_URL, then
  OPENAI_BASE_URL, then OPENAI_API_BASE, then https://api.openai.com/v1.
.PARAMETER Model
  Model name. Defaults to MASTER_EVAL_MODEL, then OPENAI_MODEL.
.PARAMETER ApiKeyEnv
  Environment variable name containing the API key. Defaults to MASTER_EVAL_API_KEY.
.PARAMETER RequireJson
  Require every model output to parse as JSON. A case can also set
  "requireJson": true to opt in per-case.
.PARAMETER Json
  Emit a machine-readable JSON summary to stdout.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$CasesDir = "",

    [Parameter(Mandatory = $false)]
    [string]$ResultsDir = "",

    [Parameter(Mandatory = $false)]
    [string]$PromptFile = "",

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$Model = "",

    [Parameter(Mandatory = $false)]
    [string]$ApiKeyEnv = "MASTER_EVAL_API_KEY",

    [Parameter(Mandatory = $false)]
    [int]$MaxTokens = 1200,

    [Parameter(Mandatory = $false)]
    [double]$Temperature = 0,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 120,

    [Parameter(Mandatory = $false)]
    [switch]$RequireJson,

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

function New-SafeFileName {
    param(
        [Parameter(Mandatory = $true)][string]$Value
    )
    $safe = $Value -replace '[^A-Za-z0-9._-]', '-'
    $safe = $safe.Trim("-")
    if ([string]::IsNullOrWhiteSpace($safe)) {
        return "case"
    }
    return $safe
}

function Get-StringArray {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        return @()
    }
    return @($Object.$Name | ForEach-Object { [string]$_ })
}

function Test-ContainsText {
    param(
        [Parameter(Mandatory = $true)][string]$Haystack,
        [Parameter(Mandatory = $true)][string]$Needle
    )
    return ($Haystack.IndexOf($Needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
}

function Get-CandidateGroups {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    if (-not (Has-Property -Object $Object -Name $Name)) {
        return @()
    }

    $groups = New-Object System.Collections.Generic.List[object]
    foreach ($group in @($Object.$Name)) {
        if ($group -is [System.Array]) {
            $groups.Add(@($group | ForEach-Object { [string]$_ })) | Out-Null
        } else {
            $groups.Add(@([string]$group)) | Out-Null
        }
    }
    return @($groups.ToArray())
}

function Test-JsonOutput {
    param(
        [Parameter(Mandatory = $true)][string]$Text
    )

    try {
        $Text | ConvertFrom-Json | Out-Null
        return [ordered]@{
            ok = $true
            mode = "direct"
            error = ""
        }
    } catch {
        $directError = $_.Exception.Message
    }

    $match = [regex]::Match($Text, '(?is)```\s*(?:json)?\s*(.*?)\s*```')
    if ($match.Success) {
        $candidate = [string]$match.Groups[1].Value
        try {
            $candidate | ConvertFrom-Json | Out-Null
            return [ordered]@{
                ok = $true
                mode = "extracted"
                error = ""
            }
        } catch {
            return [ordered]@{
                ok = $false
                mode = "failed"
                error = "Direct parse failed: $directError; extracted parse failed: $($_.Exception.Message)"
            }
        }
    }

    return [ordered]@{
        ok = $false
        mode = "failed"
        error = $directError
    }
}

function Invoke-ChatCompletion {
    param(
        [Parameter(Mandatory = $true)][string]$Endpoint,
        [Parameter(Mandatory = $true)][string]$ApiKey,
        [Parameter(Mandatory = $true)][string]$ModelName,
        [Parameter(Mandatory = $true)][string]$SystemPrompt,
        [Parameter(Mandatory = $true)][string]$UserInput,
        [Parameter(Mandatory = $true)][int]$MaxTokensValue,
        [Parameter(Mandatory = $true)][double]$TemperatureValue,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds
    )

    $headers = @{
        Authorization = "Bearer $ApiKey"
    }
    $body = [ordered]@{
        model = $ModelName
        messages = @(
            [ordered]@{
                role = "system"
                content = $SystemPrompt
            },
            [ordered]@{
                role = "user"
                content = $UserInput
            }
        )
        temperature = $TemperatureValue
        max_tokens = $MaxTokensValue
    }

    $bodyJson = $body | ConvertTo-Json -Depth 12
    try {
        return Invoke-RestMethod `
            -Uri $Endpoint `
            -Method Post `
            -Headers $headers `
            -Body $bodyJson `
            -ContentType "application/json; charset=utf-8" `
            -TimeoutSec $TimeoutSeconds
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response -and [int]$response.StatusCode -eq 401) {
            throw "401 Unauthorized. Check MASTER_EVAL_API_KEY or -ApiKeyEnv, confirm the base URL matches the provider, and confirm the model is available to the key."
        }
        throw
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($CasesDir)) {
        $CasesDir = Join-Path $PSScriptRoot "cases"
    }
    if ([string]::IsNullOrWhiteSpace($ResultsDir)) {
        $ResultsDir = Join-Path $PSScriptRoot "results"
    }
    if ([string]::IsNullOrWhiteSpace($PromptFile)) {
        $PromptFile = Join-Path (Split-Path -Parent $PSScriptRoot) "prompts\01-core-master-framework.md"
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = [Environment]::GetEnvironmentVariable("MASTER_EVAL_BASE_URL")
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = [Environment]::GetEnvironmentVariable("OPENAI_BASE_URL")
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = [Environment]::GetEnvironmentVariable("OPENAI_API_BASE")
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = "https://api.openai.com/v1"
    }
    if ([string]::IsNullOrWhiteSpace($Model)) {
        $Model = [Environment]::GetEnvironmentVariable("MASTER_EVAL_MODEL")
    }
    if ([string]::IsNullOrWhiteSpace($Model)) {
        $Model = [Environment]::GetEnvironmentVariable("OPENAI_MODEL")
    }

    $apiKey = [Environment]::GetEnvironmentVariable($ApiKeyEnv)
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "Missing API key. Set $ApiKeyEnv or pass -ApiKeyEnv with a populated environment variable."
    }
    if ([string]::IsNullOrWhiteSpace($Model)) {
        throw "Missing model. Set MASTER_EVAL_MODEL, OPENAI_MODEL, or pass -Model."
    }

    $resolvedCasesDir = (Resolve-Path -LiteralPath $CasesDir).Path
    $resolvedPromptFile = (Resolve-Path -LiteralPath $PromptFile).Path
    $promptText = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolvedPromptFile
    $systemPrompt = @"
$promptText

Offline LLM behavior eval instructions:
- Do not execute commands.
- Do not create real Agents.
- Do not call OpenClaw actions.
- Do not claim that actions were performed unless the user input only asks for a plan or contract.
- Respond as Master Orchestrator using the governance rules above.

Runtime Validation Eval Instruction:
- Output only valid JSON.
- Conform to master_output_contract.v1.
- Do not include prose before or after JSON.
- Do not wrap JSON in markdown code fences.
- Start the response with { and end with }.
- Include version, decision, phase, realGoal, nonGoals, executionClarity,
  minimumPrototype, executionContract.allowedActions,
  executionContract.forbiddenActions, executionContract.riskBoundaries,
  executionContract.validationPlan, shouldCreateAgent, and nextAction.
"@

    $endpoint = ($BaseUrl.TrimEnd("/")) + "/chat/completions"
    $runId = (Get-Date).ToString("yyyyMMdd-HHmmss")
    $runDir = Join-Path $ResultsDir $runId
    New-Item -ItemType Directory -Force -Path $runDir | Out-Null

    $files = @(Get-ChildItem -LiteralPath $resolvedCasesDir -Filter *.json -File | Sort-Object Name)
    if ($files.Count -lt 1) {
        throw "No eval case JSON files found in $resolvedCasesDir."
    }

    $results = New-Object System.Collections.Generic.List[object]

    foreach ($file in $files) {
        $issues = New-Object System.Collections.Generic.List[string]
        $caseId = $file.BaseName
        $outputPath = ""
        $outputText = ""

        try {
            $case = Get-Content -Raw -Encoding UTF8 -LiteralPath $file.FullName | ConvertFrom-Json
            if ((Has-Property -Object $case -Name "id") -and -not [string]::IsNullOrWhiteSpace([string]$case.id)) {
                $caseId = [string]$case.id
            }

            foreach ($field in @("input", "mustContain", "mustNotContain")) {
                if (-not (Has-Property -Object $case -Name $field)) {
                    Add-Issue -Issues $issues -Message "$field must be present."
                }
            }

            if ($issues.Count -eq 0) {
                $input = [string]$case.input
                if ([string]::IsNullOrWhiteSpace($input)) {
                    Add-Issue -Issues $issues -Message "input must be non-empty."
                }
            }

            if ($issues.Count -eq 0) {
                $response = Invoke-ChatCompletion `
                    -Endpoint $endpoint `
                    -ApiKey $apiKey `
                    -ModelName $Model `
                    -SystemPrompt $systemPrompt `
                    -UserInput $input `
                    -MaxTokensValue $MaxTokens `
                    -TemperatureValue $Temperature `
                    -TimeoutSeconds $TimeoutSec

                if ($null -eq $response.choices -or @($response.choices).Count -lt 1) {
                    Add-Issue -Issues $issues -Message "API response did not include choices."
                } else {
                    $outputText = [string]$response.choices[0].message.content
                }
            }

            $safeName = New-SafeFileName -Value $caseId
            $outputPath = Join-Path $runDir "$safeName.txt"
            Set-Content -LiteralPath $outputPath -Encoding UTF8 -Value $outputText

            if ($issues.Count -eq 0) {
                foreach ($needle in (Get-StringArray -Object $case -Name "mustContain")) {
                    if (-not (Test-ContainsText -Haystack $outputText -Needle $needle)) {
                        Add-Issue -Issues $issues -Message "Missing required text: $needle"
                    }
                }
                foreach ($group in (Get-CandidateGroups -Object $case -Name "mustContainAny")) {
                    $matched = $false
                    foreach ($candidate in @($group)) {
                        if (Test-ContainsText -Haystack $outputText -Needle $candidate) {
                            $matched = $true
                            break
                        }
                    }
                    if (-not $matched) {
                        Add-Issue -Issues $issues -Message "Missing required text group: $(@($group) -join ' | ')"
                    }
                }
                foreach ($needle in (Get-StringArray -Object $case -Name "mustNotContain")) {
                    if (Test-ContainsText -Haystack $outputText -Needle $needle) {
                        Add-Issue -Issues $issues -Message "Forbidden text present: $needle"
                    }
                }

                $caseRequiresJson = $false
                if ((Has-Property -Object $case -Name "requireJson") -and [bool]$case.requireJson) {
                    $caseRequiresJson = $true
                }
                if ($RequireJson -or $caseRequiresJson) {
                    $jsonCheck = Test-JsonOutput -Text $outputText
                    if (-not $jsonCheck.ok) {
                        Add-Issue -Issues $issues -Message "Output is not valid JSON: $($jsonCheck.error)"
                    }
                }
            }
        } catch {
            Add-Issue -Issues $issues -Message $_.Exception.Message
            if ([string]::IsNullOrWhiteSpace($outputPath)) {
                $safeName = New-SafeFileName -Value $caseId
                $outputPath = Join-Path $runDir "$safeName.txt"
                Set-Content -LiteralPath $outputPath -Encoding UTF8 -Value $outputText
            }
        }

        $results.Add([ordered]@{
            id = $caseId
            file = $file.Name
            ok = ($issues.Count -eq 0)
            issues = @($issues.ToArray())
            outputPath = $outputPath
        }) | Out-Null
    }

    $failed = @($results.ToArray() | Where-Object { -not $_.ok })
    $summary = [ordered]@{
        ok = ($failed.Count -eq 0)
        total = $files.Count
        failed = $failed.Count
        model = $Model
        baseUrl = $BaseUrl
        promptFile = $resolvedPromptFile
        runDir = $runDir
        results = @($results.ToArray())
    }

    $summaryJsonPath = Join-Path $runDir "summary.json"
    $summaryMdPath = Join-Path $runDir "summary.md"
    Set-Content -LiteralPath $summaryJsonPath -Encoding UTF8 -Value ($summary | ConvertTo-Json -Depth 10)

    $summaryLines = New-Object System.Collections.Generic.List[string]
    $summaryLines.Add("# LLM Eval Summary") | Out-Null
    $summaryLines.Add("") | Out-Null
    $summaryLines.Add("- Model: $Model") | Out-Null
    $summaryLines.Add("- Base URL: $BaseUrl") | Out-Null
    $summaryLines.Add("- Total: $($files.Count)") | Out-Null
    $summaryLines.Add("- Failed: $($failed.Count)") | Out-Null
    $summaryLines.Add("") | Out-Null
    foreach ($result in $results) {
        $status = if ($result.ok) { "PASS" } else { "FAIL" }
        $summaryLines.Add("## $status $($result.id)") | Out-Null
        $summaryLines.Add("") | Out-Null
        $summaryLines.Add("- Case: $($result.file)") | Out-Null
        $summaryLines.Add("- Output: $($result.outputPath)") | Out-Null
        if (-not $result.ok) {
            $summaryLines.Add("- Issues:") | Out-Null
            foreach ($issue in $result.issues) {
                $summaryLines.Add("  - $issue") | Out-Null
            }
        }
        $summaryLines.Add("") | Out-Null
    }
    Set-Content -LiteralPath $summaryMdPath -Encoding UTF8 -Value $summaryLines

    if ($Json) {
        Write-Output ($summary | ConvertTo-Json -Depth 10 -Compress)
    } else {
        Write-Output "LLM eval results: $runDir"
        foreach ($result in $results) {
            $status = if ($result.ok) { "PASS" } else { "FAIL" }
            Write-Output "$status $($result.id) -> $($result.outputPath)"
            if (-not $result.ok) {
                foreach ($issue in $result.issues) {
                    Write-Output "  - $issue"
                }
            }
        }
        Write-Output "Summary: $summaryMdPath"
    }

    if ($failed.Count -gt 0) {
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
