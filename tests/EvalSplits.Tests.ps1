BeforeAll {
    $script:Root = Split-Path -Parent $PSScriptRoot
    $script:SplitManifest = Get-Content -Raw "$script:Root/evals/runtime-splits.json" | ConvertFrom-Json
    $script:Definitions = @(Get-ChildItem "$script:Root/evals/runtime-cases" -Filter *.json | ForEach-Object { Get-Content -Raw $_.FullName | ConvertFrom-Json })
}
Describe 'Runtime evaluation dataset boundaries' {
    It 'keeps twelve unique scenarios in disjoint four-case splits' {
        $script:Definitions.Count | Should -Be 12
        @($script:Definitions.id | Select-Object -Unique).Count | Should -Be 12
        foreach ($split in @('train','validation','test')) {
            @($script:Definitions | Where-Object split -EQ $split).Count | Should -Be 4
        }
    }
    It 'detects input duplicates and preserves manifest hashes' {
        $hashes = @($script:Definitions | ForEach-Object {
            $bytes = [Text.Encoding]::UTF8.GetBytes($_.input)
            $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
            ($script:SplitManifest.cases | Where-Object id -EQ $_.id).inputSha256 | Should -Be $hash
            $hash
        })
        @($hashes | Select-Object -Unique).Count | Should -Be 12
    }
    It 'exposes only training cases to a prospective optimizer' {
        @($script:SplitManifest.optimizerVisibleSplits).Count | Should -Be 1
        $script:SplitManifest.optimizerVisibleSplits[0] | Should -Be 'train'
        $script:SplitManifest.modelBehaviorResults | Should -Be 'not_run'
    }
    It 'uses structured checks while declaring their semantic limits' {
        foreach ($case in $script:Definitions) {
            @($case.behaviorChecks).Count | Should -BeGreaterThan 0
            @($case.mustContain).Count | Should -Be 0
            $case.limitations | Should -Match 'semantic/runtime review'
        }
    }
}
