#Requires -Modules Pester

BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Describe "core schema documentation" {
    $schemaNames = @(
        "agent_pack.v1.schema.json",
        "micro_sop.v1.schema.json",
        "requirement_clarity.v1.schema.json",
        "task_analysis.v1.schema.json"
    )

    $cases = @($schemaNames | ForEach-Object { @{ SchemaName = $_ } })
    It "<SchemaName> has a root description and example" -TestCases $cases {
            param($SchemaName)
            $path = Join-Path $script:RepoRoot "schemas\$SchemaName"
            $schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json

            $schema.description | Should -Not -BeNullOrEmpty
            @($schema.examples).Count | Should -BeGreaterThan 0
    }
}
