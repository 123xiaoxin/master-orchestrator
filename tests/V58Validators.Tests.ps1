#Requires -Modules Pester

BeforeAll {
    . "$PSScriptRoot\TestSupport.ps1"
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $script:Validators = @{
        CapabilityGap = Join-Path $script:RepoRoot "helpers\validate_capability_gap.ps1"
        FinalReport = Join-Path $script:RepoRoot "helpers\validate_final_report.ps1"
        FiveLayerSnapshot = Join-Path $script:RepoRoot "helpers\validate_five_layer_snapshot.ps1"
        GoalPursuitLedger = Join-Path $script:RepoRoot "helpers\validate_goal_pursuit_ledger.ps1"
    }

    function Invoke-JsonValidator {
        param(
            [Parameter(Mandatory = $true)][string]$ValidatorPath,
            [Parameter(Mandatory = $true)][string[]]$Path
        )
        $output = & $ValidatorPath -File $Path -Json
        return (($output | Select-Object -Last 1) | ConvertFrom-Json)
    }

    function Write-Record {
        param(
            [Parameter(Mandatory = $true)]$Record,
            [Parameter(Mandatory = $true)][string]$Path
        )
        Write-Utf8NoBom -Path $Path -Content ($Record | ConvertTo-Json -Depth 20)
    }

    function New-CapabilityGapRecord {
        return [ordered]@{
            schemaVersion = "capability_gap.v1"
            missingCapability = "Screenshot verification"
            impact = "Rendered UI cannot be visually verified."
            candidateRoutes = @(
                [ordered]@{
                    route = "degrade"
                    reason = "Use structural validation."
                    riskLevel = "L1"
                    requiresUserAuthorization = $false
                }
            )
            selectedRoute = "degrade"
            riskLevel = "L1"
            requiresUserAuthorization = $false
            verificationPlan = "Validate HTML structure."
            fallback = "manual_handoff"
        }
    }

    function New-FinalReportRecord {
        return [ordered]@{
            schemaVersion = "final_report.v1"
            taskId = "task-1"
            completed = @("Documentation updated")
            verificationResults = @(
                [ordered]@{ check = "encoding"; result = "passed" }
            )
            risks = @()
            unfinishedItems = @()
            skillDepositionCandidate = $false
            depositionTarget = ""
            nextActions = @()
            finalStatus = "completed"
            sourceOfTruthGate = [ordered]@{
                declaredEvidenceMatchesObservedEvidence = $true
                unaccountedToolCalls = @()
                inventedToolCalls = @()
                phaseAttributionMismatch = @()
                counterAgentTruthMismatch = @()
                asyncBoundaryIncomplete = $false
                ledgerUnverified = $false
            }
            updatedAt = "2026-06-17T10:00:00Z"
        }
    }

    function New-FiveLayerSnapshotRecord {
        return [ordered]@{
            schemaVersion = "five_layer_snapshot.v1"
            modelLayer = [ordered]@{ fit = "sufficient"; notes = @("Can reason about the task.") }
            harnessLayer = [ordered]@{ fit = "partial"; requiredControls = @("Final Report") }
            promptLayer = [ordered]@{ fit = "partial"; requiredViews = @("Engineering") }
            skillLayer = [ordered]@{ fit = "partial"; availableTools = @("repository read"); missingTools = @("screenshot verification") }
            ragMemoryLayer = [ordered]@{ fit = "unknown"; requiredContext = @("repository docs"); missingContext = @("brand constraints") }
        }
    }

    function New-GoalPursuitLedgerRecord {
        return [ordered]@{
            schemaVersion = "goal_pursuit_ledger.v1"
            taskId = "task-1"
            goalAnchor = [ordered]@{
                trueGoal = "Validate docs"
                userValue = "Safe merge"
                nonGoals = @("Do not change runtime behavior")
                successCriteria = @("Validation passes")
                riskBoundary = "Docs and validation only"
            }
            progressLedger = [ordered]@{
                currentPhase = "phase_4"
                completed = @("Read docs")
                inProgress = @()
                blocked = @()
                nextAction = "Run validation"
                deviation = ""
                risk = ""
                lastVerification = "Not yet run"
            }
            evidenceLedger = [ordered]@{
                readFiles = @("README.md")
                toolCalls = @("check_encoding.ps1")
                assumptions = @()
                unavailableEvidence = @()
                finalReportConsistencyCheck = "passed"
            }
            capabilityFailureDisclosure = [ordered]@{
                failedTools = @()
                unavailableCapabilities = @()
                degradedCapabilities = @()
                whetherDisclosedInFinalReport = $true
            }
            reviewLedger = [ordered]@{
                requiredReview = @("internal_checklist")
                reviewMode = "internal_checklist"
                counterAgentUsed = $false
                humanConfirmationNeeded = $false
            }
            completionVerification = [ordered]@{
                goalAchieved = $true
                verificationPassed = $true
                finalStatus = "completed"
            }
            updatedAt = "2026-06-17T10:00:00Z"
        }
    }
}

Describe "v5.8 validator coverage" {
    It "validates all capability_gap examples" {
        $files = @(Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot "examples\capability-gap") -Filter *.json -File)
        $result = Invoke-JsonValidator -ValidatorPath $script:Validators.CapabilityGap -Path $files.FullName
        $result.ok | Should -BeTrue
    }

    It "validates all final_report examples" {
        $files = @(Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot "examples\final-report") -Filter *.json -File)
        $result = Invoke-JsonValidator -ValidatorPath $script:Validators.FinalReport -Path $files.FullName
        $result.ok | Should -BeTrue
    }

    It "validates all five_layer_snapshot examples" {
        $files = @(Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot "examples\five-layer-snapshot") -Filter *.json -File)
        $result = Invoke-JsonValidator -ValidatorPath $script:Validators.FiveLayerSnapshot -Path $files.FullName
        $result.ok | Should -BeTrue
    }

    It "validates all goal_pursuit_ledger examples" {
        $files = @(Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot "examples\goal-pursuit-ledger") -Filter *.json -File)
        $result = Invoke-JsonValidator -ValidatorPath $script:Validators.GoalPursuitLedger -Path $files.FullName
        $result.ok | Should -BeTrue
    }

    It "rejects a capability gap selectedRoute outside candidateRoutes" {
        $sandbox = New-TestSandbox
        try {
            $record = New-CapabilityGapRecord
            $record.selectedRoute = "manual_handoff"
            $path = Join-Path $sandbox "bad-capability-gap.json"
            Write-Record -Record $record -Path $path

            $result = Invoke-JsonValidator -ValidatorPath $script:Validators.CapabilityGap -Path $path
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "candidateRoutes"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects completed final reports with unverified ledgers" {
        $sandbox = New-TestSandbox
        try {
            $record = New-FinalReportRecord
            $record.sourceOfTruthGate.ledgerUnverified = $true
            $path = Join-Path $sandbox "bad-final-report.json"
            Write-Record -Record $record -Path $path

            $result = Invoke-JsonValidator -ValidatorPath $script:Validators.FinalReport -Path $path
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "ledgerUnverified"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects invalid five-layer fit values" {
        $sandbox = New-TestSandbox
        try {
            $record = New-FiveLayerSnapshotRecord
            $record.modelLayer.fit = "excellent"
            $path = Join-Path $sandbox "bad-five-layer.json"
            Write-Record -Record $record -Path $path

            $result = Invoke-JsonValidator -ValidatorPath $script:Validators.FiveLayerSnapshot -Path $path
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "modelLayer.fit"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }

    It "rejects completed goal ledgers without verification" {
        $sandbox = New-TestSandbox
        try {
            $record = New-GoalPursuitLedgerRecord
            $record.completionVerification.verificationPassed = $false
            $path = Join-Path $sandbox "bad-goal-ledger.json"
            Write-Record -Record $record -Path $path

            $result = Invoke-JsonValidator -ValidatorPath $script:Validators.GoalPursuitLedger -Path $path
            $result.ok | Should -BeFalse
            $result.results[0].issues -join " " | Should -Match "verificationPassed"
        } finally {
            Remove-Item -LiteralPath $sandbox -Recurse -Force
        }
    }
}
