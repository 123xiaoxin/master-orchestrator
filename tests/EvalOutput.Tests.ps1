BeforeAll {
    $root = Split-Path -Parent $PSScriptRoot
    . "$root/evals/EvaluateOutput.ps1"
    $script:Schema = "$root/schemas/master_output_contract.v1.schema.json"
    $script:Valid = (Get-Content -Raw $script:Schema | ConvertFrom-Json).examples[0] | ConvertTo-Json -Depth 20
}
Describe 'Structural evaluation and feedback isolation' {
    It 'fails empty content without a binding exception' {
        (Test-MasterEvalOutput -Text '' -SchemaFile $script:Schema).category | Should -Be 'empty_output'
    }
    It 'separates truncation from invalid JSON' {
        (Test-MasterEvalOutput -Text '{' -FinishReason length -SchemaFile $script:Schema).category | Should -Be 'truncation'
    }
    It 'rejects malformed JSON' {
        (Test-MasterEvalOutput -Text '{' -SchemaFile $script:Schema).category | Should -Be 'json_error'
    }
    It 'rejects valid JSON with missing contract fields' {
        (Test-MasterEvalOutput -Text '{"decision":"execute"}' -SchemaFile $script:Schema).category | Should -Be 'schema_error'
    }
    It 'rejects schema invalid nested types' {
        $o = $script:Valid | ConvertFrom-Json
        $o.shouldCreateAgent = 'false'
        (Test-MasterEvalOutput -Text ($o | ConvertTo-Json -Depth 20) -SchemaFile $script:Schema).category | Should -Be 'schema_error'
    }
    It 'uses parsed fields rather than a keyword elsewhere in output' {
        $o = $script:Valid | ConvertFrom-Json
        $o.nextAction = 'clarify keyword is present, but the decision is execute'
        $check = [pscustomobject]@{path='decision';op='equals';value='clarify'}
        $r = Test-MasterEvalOutput -Text ($o | ConvertTo-Json -Depth 20) -SchemaFile $script:Schema -Checks @($check)
        $r.category | Should -Be 'behavior_error'
        ($r.codes -join ' ') | Should -Not -Match 'clarify|decision'
    }
    It 'records rule evidence without claiming semantic judgment' {
        $check = [pscustomobject]@{path='decision';op='equals';value='execute'}
        $r = Test-MasterEvalOutput -Text $script:Valid -SchemaFile $script:Schema -Checks @($check)
        $r.ok | Should -BeTrue
        $r.semanticJudgment | Should -Be 'not_performed'
    }
    It 'rejects unknown checks rather than silently accepting them' {
        { Test-MasterEvalOutput -Text $script:Valid -SchemaFile $script:Schema -Checks @([pscustomobject]@{path='decision';op='unknown'}) } | Should -Throw
    }
}
