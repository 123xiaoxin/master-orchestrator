#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:CreatePack = Join-Path $script:RepoRoot "helpers\create_agent_pack.ps1"
    $script:ValidateTemplates = Join-Path $script:RepoRoot "helpers\validate_templates.ps1"
}

Describe "portable Agent Pack validation" {
    BeforeEach {
        $script:Sandbox = New-TestSandbox
        $script:AgencyRoot = Join-Path $script:Sandbox "agency-agents"
        $script:TemplatesRoot = Join-Path $script:Sandbox "templates"
        New-TestExpert -AgencyRoot $script:AgencyRoot -Name "test-expert"
        New-TestAgentPackTemplate -Path (Join-Path $script:TemplatesRoot "portable.json") -ExpertName "test-expert"
    }

    AfterEach {
        Remove-Item -LiteralPath $script:Sandbox -Recurse -Force
    }

    It "uses the injected AgencyRoot during create_agent_pack dry-run" {
        $output = & $script:CreatePack `
            -TemplateFile (Join-Path $script:TemplatesRoot "portable.json") `
            -AgencyRoot $script:AgencyRoot `
            -DryRun

        $LASTEXITCODE | Should -Be 0
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.validation.ok | Should -BeTrue
        $result.agents[0].expertFile | Should -Be (Join-Path $script:AgencyRoot "test-expert\AGENTS.md")
    }

    It "passes AgencyRoot through validate_templates" {
        $output = & $script:ValidateTemplates `
            -TemplatesRoot $script:TemplatesRoot `
            -AgencyRoot $script:AgencyRoot

        $LASTEXITCODE | Should -Be 0
        $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
        $result.ok | Should -BeTrue
        $result.failed | Should -Be 0
        $result.agencyRoot | Should -Be (Resolve-Path $script:AgencyRoot).Path
    }

    It "passes the validated expert file into real agent creation" {
        $originalUserProfile = $env:USERPROFILE
        try {
            $env:USERPROFILE = $script:Sandbox
            function global:openclaw {
                $global:LASTEXITCODE = 0
                "{}"
            }

            $output = & $script:CreatePack `
                -TemplateFile (Join-Path $script:TemplatesRoot "portable.json") `
                -AgencyRoot $script:AgencyRoot `
                -PackId "portable-integration" `
                -Model "test/model"

            $LASTEXITCODE | Should -Be 0
            $result = ($output | Select-Object -Last 1) | ConvertFrom-Json
            $result.agents[0].expertFile | Should -Be (Join-Path $script:AgencyRoot "test-expert\AGENTS.md")
        } finally {
            Remove-Item function:\global:openclaw -ErrorAction SilentlyContinue
            $env:USERPROFILE = $originalUserProfile
        }
    }
}
