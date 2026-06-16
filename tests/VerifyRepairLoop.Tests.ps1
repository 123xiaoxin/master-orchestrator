#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:SchemaPath = Join-Path $script:RepoRoot "schemas\verify_repair_loop.v1.schema.json"
    $script:ValidatorPath = Join-Path $script:RepoRoot "helpers\validate_verify_repair_loop.ps1"
    $script:ExamplesRoot = Join-Path $script:RepoRoot "examples\verify-repair"

    function New-VerifyRepairRecord {
        return [ordered]@{
            schemaVersion = "verify_repair_loop.v1"
            target = "Test verification target"
            verifyStep = [ordered]@{
                command = ".\scripts\check_encoding.ps1"
                scope = "Repository text files"
            }
            expectedSignal = "OK check passed"
            status = "pending_verification"
            attempt = 0
            maxAttempts = 2
            attempts = @()
            nextAction = "Run verification."
            updatedAt = "2026-06-17T10:00:00Z"
        }
    }
}

Describe "verify_repair_loop.v1 contract" {
    It "schema exists and enforces maxAttempts=2" {
        $script:SchemaPath | Should -Exist
        $schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:SchemaPath | ConvertFrom-Json
        $schema.properties.maxAttempts.const | Should -Be 2
    }

    It "validates all repository examples" {
        $script:ValidatorPath | Should -Exist
        $files = @(Get-ChildItem -LiteralPath $script:ExamplesRoot -Filter *.json -File)
        $files.Count | Should -BeGreaterThan 0

        $output = & $script:ValidatorPath -File $files.FullName -Json
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.ok | Should -BeTrue
    }

    It "rejects maxAttempts other than 2" {
        $sandbox = New-TestSandbox
        try {
            $record = New-VerifyRepairRecord
            $record.maxAttempts = 5
            $path = Join-Path $sandbox "invalid-max.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "maxAttempts"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects more than 2 recorded attempts" {
        $sandbox = New-TestSandbox
        try {
            $record = New-VerifyRepairRecord
            $record.attempts = @(
                @{ attempt = 1; failureReason = "First fail"; repairAction = @{ summary = "Fix 1"; changedFiles = @("a.txt") }; result = "repair_applied" },
                @{ attempt = 2; failureReason = "Second fail"; repairAction = @{ summary = "Fix 2"; changedFiles = @("b.txt") }; result = "repair_applied" },
                @{ attempt = 3; failureReason = "Third fail"; repairAction = @{ summary = "Fix 3"; changedFiles = @("c.txt") }; result = "exhausted" }
            )
            $path = Join-Path $sandbox "too-many-attempts.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "exceed 2"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "requires verifyStep with command and scope" {
        $sandbox = New-TestSandbox
        try {
            $record = New-VerifyRepairRecord
            $record.verifyStep = [ordered]@{}
            $path = Join-Path $sandbox "missing-verify-step.json"
            Write-Utf8NoBom -Path $path -Content ($record | ConvertTo-Json -Depth 12)

            $output = & $script:ValidatorPath -File $path -Json
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.ok | Should -BeFalse
            $issues = $result.results[0].issues -join " "
            $issues | Should -Match "command"
            $issues | Should -Match "scope"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }
}