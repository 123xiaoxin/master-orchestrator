#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:Runner = Join-Path (Split-Path -Parent $PSScriptRoot) "evals/run_llm_evals.ps1"
}

Describe "LLM eval source provenance without paid calls" {
    BeforeEach {
        $script:Sandbox = New-TestSandbox
        $script:OriginalKey = [Environment]::GetEnvironmentVariable("MASTER_INTEGRATION_TEST_KEY")
        $env:MASTER_INTEGRATION_TEST_KEY = "mock-only-not-a-real-key"
        $script:Prompt = Join-Path $script:Sandbox "master-prompt.md"
        Write-Utf8NoBom -Path $script:Prompt -Content "Mock selected governance snapshot."
        $script:Cases = Join-Path $script:Sandbox "cases"
        Write-Utf8NoBom -Path (Join-Path $script:Cases "source-test.json") -Content '{"id":"source-test","input":"A vague task","mustContain":["clarify"],"mustNotContain":["invented_call"],"requireJson":true}'
        $script:Results = Join-Path $script:Sandbox "results"
        Mock Invoke-RestMethod { return @{ choices = @(@{ finish_reason = 'stop'; message = @{ content = '{"version":"master_output_contract.v1","decision":"clarify","phase":"phase_minus_1b","realGoal":"Clarify the requested outcome","nonGoals":[],"executionClarity":{"score":30,"rationale":"Critical requirements missing"},"minimumPrototype":null,"executionContract":{"allowedActions":[],"forbiddenActions":["execute"],"riskBoundaries":["No actions"],"validationPlan":["Confirm outcome"]},"shouldCreateAgent":false,"nextAction":"Ask one critical question"}' } }) } }
    }

    AfterEach {
        [Environment]::SetEnvironmentVariable("MASTER_INTEGRATION_TEST_KEY", $script:OriginalKey)
        # Fresh GUID sandbox created by New-TestSandbox; never a runtime installation.
        Remove-Item -LiteralPath $script:Sandbox -Recurse -Force
    }

    It "rejects implicit 01-only input before any model request" {
        { & $script:Runner -CasesDir $script:Cases -ResultsDir $script:Results -Model mock -ApiKeyEnv MASTER_INTEGRATION_TEST_KEY -BaseUrl https://example.invalid -TimeoutSec 1 -ErrorAction Stop } | Should -Throw '*explicit -PromptFile*'
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly
    }

    It "rejects a changed snapshot with a stale source lock before a model request" {
        Write-Utf8NoBom -Path (Join-Path $script:Sandbox "source-lock.json") -Content '{"artifacts":{"master-prompt.md":"stale-hash"}}'
        { & $script:Runner -PromptFile $script:Prompt -CasesDir $script:Cases -ResultsDir $script:Results -Model mock -ApiKeyEnv MASTER_INTEGRATION_TEST_KEY -BaseUrl https://example.invalid -TimeoutSec 1 -ErrorAction Stop } | Should -Throw '*source lock does not match*'
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly
    }

    It "retains the exact selected Prompt hash and source lock in a mocked run" {
        $hash = (Get-FileHash -LiteralPath $script:Prompt -Algorithm SHA256).Hash.ToLowerInvariant()
        Write-Utf8NoBom -Path (Join-Path $script:Sandbox "source-lock.json") -Content ('{"artifacts":{"master-prompt.md":"' + $hash + '"}}')
        $output = & $script:Runner -PromptFile $script:Prompt -CasesDir $script:Cases -ResultsDir $script:Results -Model mock -ApiKeyEnv MASTER_INTEGRATION_TEST_KEY -BaseUrl https://example.invalid -TimeoutSec 1 -RequireJson -Json
        $summary = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $summary.ok | Should -BeTrue
        $summary.promptSha256 | Should -Be $hash
        $summary.sourceLockAvailable | Should -BeTrue
        (Join-Path $summary.runDir "source-lock.json") | Should -Exist
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly
    }

    It "rejects incompatible intent records before a model request" {
        Write-Utf8NoBom -Path (Join-Path $script:Cases "source-test.json") -Content '{"id":"elicit-no-default-options","input":"Vague intent","mustContain":["intent_elicitation.v1"],"mustNotContain":[]}'
        $output = & $script:Runner -PromptFile $script:Prompt -CasesDir $script:Cases -ResultsDir $script:Results -Model mock -ApiKeyEnv MASTER_INTEGRATION_TEST_KEY -BaseUrl https://example.invalid -TimeoutSec 1 -Json
        $summary = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $summary.ok | Should -BeFalse
        $summary.results[0].issues | Should -Contain 'unsupported_output_contract_for_v1_runner'
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly
    }
}
