#Requires -Modules Pester

BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Describe "core schema documentation" {
    $schemaNames = @(
        "agent_pack.v1.schema.json",
        "capability_gap.v1.schema.json",
        "final_report.v1.schema.json",
        "five_layer_snapshot.v1.schema.json",
        "goal_pursuit_ledger.v1.schema.json",
        "intent_elicitation.v1.schema.json",
        "master_output_contract.v1.schema.json",
        "micro_sop.v1.schema.json",
        "requirement_clarity.v1.schema.json",
        "state_machine.v1.schema.json",
        "task_analysis.v1.schema.json",
        "verify_repair_loop.v1.schema.json"
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
