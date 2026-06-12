#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:SchemaPath = Join-Path $script:RepoRoot "schemas\intent_elicitation.v1.schema.json"
    $script:ValidatorPath = Join-Path $script:RepoRoot "helpers\validate_intent_elicitation.ps1"
    $script:ExamplesRoot = Join-Path $script:RepoRoot "examples\intent-elicit"

    function New-IntentRecord {
        return [ordered]@{
            schemaVersion = "intent_elicitation.v1"
            userLiteralRequest = "I need help shaping an idea."
            imagery = [ordered]@{
                literal = [ordered]@{
                    status = "concrete"
                    userWords = @("help", "idea")
                    userRestated = "I need help shaping an idea."
                }
                emotional = [ordered]@{
                    status = "concrete"
                    desiredFeelings = @("clear")
                    feelingsToAvoid = @("overwhelmed")
                }
                scene = [ordered]@{
                    status = "concrete"
                    openingMoment = "The user opens a short planning page."
                    firstAction = "They write the first concrete outcome."
                }
                value = [ordered]@{
                    status = "concrete"
                    whyItMatters = "The user needs a decision."
                    whatItEnables = "They can move into requirement clarification."
                }
            }
            metaphorAnchors = @()
            antiReferences = @()
            intentShifts = @()
            stopCondition = [ordered]@{
                trigger = "clarity_threshold_met"
                detail = "All four layers are concrete."
            }
            executionClarityEstimate = 0.8
            recommendedNextPhase = "phase_minus_1b_clarity_gate"
            elicitationMetadata = [ordered]@{
                turnCount = 4
                fallbackUsed = $false
            }
        }
    }
}

Describe "intent_elicitation.v1 contract" {
    It "exists and only permits continuation or Phase -1b handoff" {
        $script:SchemaPath | Should -Exist
        $schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:SchemaPath | ConvertFrom-Json
        $nextPhases = @($schema.properties.recommendedNextPhase.enum)

        $nextPhases | Should -Contain "continue_elicitation"
        $nextPhases | Should -Contain "phase_minus_1b_clarity_gate"
        $nextPhases | Should -Not -Contain "phase_0_environment_snapshot"
        $nextPhases.Count | Should -Be 2
    }

    It "validates all repository examples" {
        $script:ValidatorPath | Should -Exist
        $files = @(Get-ChildItem -LiteralPath $script:ExamplesRoot -Filter *.json -File)
        $files.Count | Should -Be 5

        $output = & $script:ValidatorPath -File $files.FullName -Json
        $LASTEXITCODE | Should -Be 0
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.ok | Should -BeTrue
        $result.total | Should -Be 5
    }

    It "rejects a direct Phase 0 handoff" {
        $sandbox = New-TestSandbox
        try {
            $record = New-IntentRecord
            $record.recommendedNextPhase = "phase_0_environment_snapshot"
            $path = Join-Path $sandbox "invalid-phase.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $LASTEXITCODE | Should -Be 1
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.results[0].issues -join " " | Should -Match "recommendedNextPhase"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "requires concrete imagery and sufficient clarity before Phase -1b handoff" {
        $sandbox = New-TestSandbox
        try {
            $record = New-IntentRecord
            $record.imagery.scene.status = "partial"
            $record.executionClarityEstimate = 0.7
            $path = Join-Path $sandbox "premature-handoff.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $LASTEXITCODE | Should -Be 1
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $issues = $result.results[0].issues -join " "
            $issues | Should -Match "concrete"
            $issues | Should -Match "0.75"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "preserves an explicit intent shift in the travel example" {
        $path = Join-Path $script:ExamplesRoot "travel-story-intent-shift.json"
        $path | Should -Exist
        $record = Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json

        @($record.intentShifts).Count | Should -BeGreaterThan 0
        $record.intentShifts[0].from | Should -Not -BeNullOrEmpty
        $record.intentShifts[0].to | Should -Not -BeNullOrEmpty
        $record.stopCondition.trigger | Should -Be "user_signal"
    }
}
