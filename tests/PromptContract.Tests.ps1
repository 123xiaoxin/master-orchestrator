#Requires -Modules Pester

BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:PromptPath = Join-Path $script:RepoRoot "prompts\06-intent-elicitation.md"
    $script:CorePath = Join-Path $script:RepoRoot "prompts\01-core-master-framework.md"
    $script:EvalRunner = Join-Path $script:RepoRoot "evals\run_prompt_evals.ps1"
}

Describe "Phase -1a prompt contract" {
    It "is optional and hands off only to Phase -1b" {
        $script:PromptPath | Should -Exist
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:PromptPath

        $content | Should -Match 'optional'
        $content | Should -Match 'phase_minus_1b_clarity_gate'
        $content | Should -Not -Match 'phase_0_environment_snapshot'
        $content | Should -Match 'does not authorize execution'
    }

    It "requires one question per turn and guards against default option anchoring" {
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:PromptPath

        $content | Should -Match 'one question per turn'
        $content | Should -Match 'Do not lead with A/B/C'
        $content | Should -Match 'fallback only'
    }

    It "is referenced by the core prompt without changing the phase order" {
        $core = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:CorePath

        $core | Should -Match 'Phase -1a'
        $core | Should -Match '06-intent-elicitation\.md'
        $core | Should -Match 'Phase -1b'
        $core.IndexOf("Phase -1a") | Should -BeLessThan $core.IndexOf("Phase -1b")
        $core.IndexOf("Phase -1b") | Should -BeLessThan $core.IndexOf("Phase 0")
    }

    It "adds four offline intent-elicitation behavior contracts" {
        $files = @(Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot "evals\cases") -Filter "elicit-*.json" -File)
        $files.Count | Should -Be 4

        $runner = Get-Content -Raw -Encoding UTF8 -LiteralPath $script:EvalRunner
        $runner | Should -Match 'hasIntentElicitation'
    }
}
