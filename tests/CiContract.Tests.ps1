#Requires -Modules Pester

BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Describe "CI contract" {
    It "provides a full-suite Pester runner" {
        $path = Join-Path $script:RepoRoot "run-tests.ps1"
        $path | Should -Exist

        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $path
        $content | Should -Match 'tests'
        $content | Should -Not -Match 'simple\.Tests\.ps1'
        $content | Should -Match 'New-PesterConfiguration'
    }

    It "makes local CI invoke the full-suite runner" {
        $path = Join-Path $script:RepoRoot "local-ci.ps1"
        $path | Should -Exist

        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $path
        $content | Should -Match 'run-tests\.ps1'
        $content | Should -Not -Match 'simple\.Tests\.ps1'
        $content | Should -Not -Match '\$LASTEXITCODE'
        $content | Should -Match 'ConvertFrom-Json'
    }

    It "uses the runner in GitHub Actions without a missing setup action" {
        $path = Join-Path $script:RepoRoot ".github\workflows\ci.yml"
        $path | Should -Exist

        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $path
        $content | Should -Match '\./local-ci\.ps1'
        $content | Should -Match 'shell:\s+pwsh'
        $content | Should -Not -Match 'actions/setup-powershell'
        $content | Should -Not -Match 'microsoft/powershell@'
    }

    It "includes tests in the repository encoding check" {
        $path = Join-Path $script:RepoRoot "scripts\check_encoding.ps1"
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $path

        $content | Should -Match '"tests"'
    }
}
