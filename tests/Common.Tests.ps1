#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    . "$PSScriptRoot\..\helpers\Common.ps1"
}

Describe "Common.ps1 shared validator helpers" {
    It "detects existing and missing properties" {
        $obj = [PSCustomObject]@{ Name = "test" }

        Has-Property -Object $obj -Name "Name" | Should -BeTrue
        Has-Property -Object $obj -Name "Missing" | Should -BeFalse
        Has-Property -Object $null -Name "Name" | Should -BeFalse
    }

    It "appends validation issues in order" {
        $issues = New-Object System.Collections.Generic.List[string]

        Add-Issue -Issues $issues -Message "first"
        Add-Issue -Issues $issues -Message "second"

        $issues.Count | Should -Be 2
        $issues[0] | Should -Be "first"
        $issues[1] | Should -Be "second"
    }

    It "resolves direct paths, wildcard specs, and duplicate matches" {
        $sandbox = New-TestSandbox
        try {
            Write-Utf8NoBom -Path (Join-Path $sandbox "a.json") -Content '{"a":1}'
            Write-Utf8NoBom -Path (Join-Path $sandbox "b.json") -Content '{"b":2}'
            Write-Utf8NoBom -Path (Join-Path $sandbox "note.txt") -Content 'note'

            $direct = Join-Path $sandbox "a.json"
            $pattern = Join-Path $sandbox "*.json"
            $result = @(Resolve-InputFiles -Specs @($direct, $pattern))

            $result.Count | Should -Be 2
            $result | Should -Contain (Resolve-Path -LiteralPath $direct).Path
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "throws when no input files match" {
        $missing = Join-Path ([System.IO.Path]::GetTempPath()) "missing-master-orchestrator-*.json"

        { Resolve-InputFiles -Specs @($missing) } | Should -Throw "*No files matched*"
    }
}
