#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:SchemaPath = Join-Path $script:RepoRoot "schemas\master_output_contract.v1.schema.json"
    $script:ValidatorPath = Join-Path $script:RepoRoot "helpers\validate_master_output_contract.ps1"
    $script:ExamplesRoot = Join-Path $script:RepoRoot "examples\master-output-contract"

    function New-OutputContractRecord {
        return [ordered]@{
            version = "master_output_contract.v1"
            decision = "execute"
            phase = "phase_1"
            realGoal = "Validate repository encoding."
            nonGoals = @("Do not modify files.")
            executionClarity = [ordered]@{
                score = 85
                rationale = "Goal and boundaries are clear."
            }
            minimumPrototype = $null
            executionContract = [ordered]@{
                allowedActions = @("Run check_encoding.ps1")
                forbiddenActions = @("Write to files")
                riskBoundaries = @("No write operations")
                validationPlan = @("Encoding check passes")
            }
            shouldCreateAgent = $false
            nextAction = "Proceed with validation."
        }
    }
}

Describe "master_output_contract.v1 contract" {
    It "schema exists and defines the decision enum" {
        $script:SchemaPath | Should -Exist
        $schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:SchemaPath | ConvertFrom-Json
        $decisions = @($schema.properties.decision.enum)
        $decisions | Should -Contain "execute"
        $decisions | Should -Contain "clarify"
        $decisions | Should -Contain "prototype"
        $decisions | Should -Contain "block"
    }

    It "validates all repository examples" {
        $script:ValidatorPath | Should -Exist
        $files = @(Get-ChildItem -LiteralPath $script:ExamplesRoot -Filter *.json -File)
        $files.Count | Should -BeGreaterThan 0

        $output = & $script:ValidatorPath -File $files.FullName -Json
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.ok | Should -BeTrue
    }

    It "rejects an invalid decision" {
        $sandbox = New-TestSandbox
        try {
            $record = New-OutputContractRecord
            $record.decision = "just_do_it"
            $path = Join-Path $sandbox "invalid-decision.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "decision"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects executionClarity.score outside 0-100" {
        $sandbox = New-TestSandbox
        try {
            $record = New-OutputContractRecord
            $record.executionClarity.score = 150
            $path = Join-Path $sandbox "invalid-clarity.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "score"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "requires executionContract with all four fields" {
        $sandbox = New-TestSandbox
        try {
            $record = New-OutputContractRecord
            $record.executionContract = [ordered]@{ allowedActions = @() }
            $path = Join-Path $sandbox "incomplete-contract.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $issues = $result.results[0].issues -join " "
            $issues | Should -Match "forbiddenActions"
            $issues | Should -Match "riskBoundaries"
            $issues | Should -Match "validationPlan"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }
}