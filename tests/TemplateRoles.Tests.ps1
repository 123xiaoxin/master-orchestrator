#Requires -Modules Pester

BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:TemplatesRoot = Join-Path $script:RepoRoot "templates"

    function Get-TemplateAgents {
        param([Parameter(Mandatory = $true)][string]$Name)
        $path = Join-Path $script:TemplatesRoot "$Name.json"
        $path | Should -Exist
        $template = Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json
        return @($template.agents)
    }
}

Describe "reusable Agent Pack role contracts" {
    It "uses engineering roles for bug reproduction, repair, and review" {
        $agents = Get-TemplateAgents -Name "bug-fix"
        @($agents.name) | Should -Be @("evidence-collector", "frontend-developer", "code-reviewer")
        @($agents[0].dependsOn) | Should -Be @()
        @($agents[1].dependsOn) | Should -Be @("evidence-collector")
        @($agents[2].dependsOn) | Should -Be @("frontend-developer")
    }

    It "separates codebase mapping, review, and finding verification" {
        $agents = Get-TemplateAgents -Name "code-review"
        @($agents.name) | Should -Be @("frontend-developer", "code-reviewer", "evidence-collector")
        @($agents[1].dependsOn) | Should -Be @("frontend-developer")
        @($agents[2].dependsOn) | Should -Be @("code-reviewer")
    }

    It "uses the established product-to-review feature workflow" {
        $agents = Get-TemplateAgents -Name "feature-request"
        @($agents.name) | Should -Be @(
            "product-manager",
            "ui-designer",
            "frontend-developer",
            "evidence-collector",
            "code-reviewer"
        )
    }

    It "uses research, analysis, and writing roles for reports" {
        $agents = Get-TemplateAgents -Name "research-report"
        @($agents.name) | Should -Be @("trend-researcher", "analytics-reporter", "content-creator")
        @($agents[1].dependsOn) | Should -Be @("trend-researcher")
        @($agents[2].dependsOn) | Should -Be @("analytics-reporter")
    }
}
