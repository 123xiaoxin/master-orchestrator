#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:SchemaPath = Join-Path $script:RepoRoot "schemas\state_machine.v1.schema.json"
    $script:ValidatorPath = Join-Path $script:RepoRoot "helpers\validate_state_machine.ps1"
    $script:ExamplesRoot = Join-Path $script:RepoRoot "examples\state-machine"

    function New-StateMachineRecord {
        return [ordered]@{
            schemaVersion = "state_machine.v1"
            taskId = "test-task"
            phase = "phase_4"
            status = "in_progress"
            currentSubtaskId = "A"
            resumeFrom = [ordered]@{
                subtaskId = "A"
                instruction = "Resume from subtask A."
                requiredArtifacts = @("output.txt")
            }
            summary = [ordered]@{
                goal = "Complete the test task."
                completed = @()
                remaining = @("Execute subtask A")
                risks = @()
                nextAction = "Execute subtask A"
            }
            repairCount = 0
            subtasks = @(
                [ordered]@{
                    id = "A"
                    title = "Test subtask"
                    status = "in_progress"
                    dependsOn = @()
                    repairCount = 0
                    artifacts = @()
                    notes = "Starting."
                }
            )
            transitions = @()
            updatedAt = "2026-06-17T10:00:00Z"
        }
    }
}

Describe "state_machine.v1 contract" {
    It "schema exists and requires phase_4" {
        $script:SchemaPath | Should -Exist
        $schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:SchemaPath | ConvertFrom-Json
        @($schema.properties.phase.enum) | Should -Contain "phase_4"
    }

    It "validates all repository examples" {
        $script:ValidatorPath | Should -Exist
        $files = @(Get-ChildItem -LiteralPath $script:ExamplesRoot -Filter *.json -File)
        $files.Count | Should -BeGreaterThan 0

        $output = & $script:ValidatorPath -File $files.FullName -Json
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.ok | Should -BeTrue
    }

    It "rejects a non-phase_4 record" {
        $sandbox = New-TestSandbox
        try {
            $record = New-StateMachineRecord
            $record.phase = "phase_1"
            $path = Join-Path $sandbox "invalid-phase.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "phase_4"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects repairCount exceeding 2" {
        $sandbox = New-TestSandbox
        try {
            $record = New-StateMachineRecord
            $record.repairCount = 3
            $path = Join-Path $sandbox "excessive-repair.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "repairCount"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "requires resumeFrom with subtaskId, instruction, and requiredArtifacts" {
        $sandbox = New-TestSandbox
        try {
            $record = New-StateMachineRecord
            $record.resumeFrom = [ordered]@{ subtaskId = "A" }
            $path = Join-Path $sandbox "incomplete-resume.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $issues = $result.results[0].issues -join " "
            $issues | Should -Match "instruction"
            $issues | Should -Match "requiredArtifacts"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }
}