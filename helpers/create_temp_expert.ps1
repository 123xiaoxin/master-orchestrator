<#
.SYNOPSIS
  读取 Agency 专家 .md 文件，创建临时 OpenClaw Agent
.DESCRIPTION
  依据外挂兵器库模式，将 agency-agents 目录中的专家定义文件，
  通过 OpenClaw CLI 动态注册为临时子 Agent。
  模型分配策略：扫描本地实际可用模型 → 按命名规律动态分类 → 按专家类型匹配
  无需硬编码任何模型 ID，跨机器即插即用。
.PARAMETER ExpertName
  专家名称，如 frontend-developer
.PARAMETER ExpertFile
  专家 .md 文件的绝对路径
.PARAMETER Model
  可选，强制指定模型 ID（覆盖自动分配）
.OUTPUTS
  成功时输出 JSON：{"agentId":"temp-xxx-12345","model":"deepseek/deepseek-chat","workspace":"..."}
  Master 解析此 JSON 获取 AgentId 和所用模型。
.EXAMPLE
  .\create_temp_expert.ps1 -ExpertName frontend-developer `
    -ExpertFile "$env:USERPROFILE\.openclaw\agency-agents\engineering\frontend-developer.md"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ExpertName,

    [Parameter(Mandatory = $true)]
    [string]$ExpertFile,

    [Parameter(Mandatory = $false)]
    [string]$Model = ""
)

# ============================================================
# 第一步：扫描本地可用模型（不依赖任何硬编码）
# ============================================================
Write-Host "🔍 正在扫描本地可用模型..."

$modelsJson = & openclaw models status --json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ 无法获取模型状态: $modelsJson"
    exit 1
}

$models = $modelsJson | ConvertFrom-Json
$allModels = @($models.allowed)
$defaultModel = $models.defaultModel
$fallbacks = @($models.fallbacks)

Write-Host "   ✅ 系统默认: $defaultModel"
Write-Host "   ✅ 可用模型: $($allModels -join ', ')"

# ============================================================
# 第二步：动态模型分类（纯规律驱动，零硬编码）
# ============================================================
$codeKeywords = @("code", "coder", "coding")
$fastKeywords = @("highspeed", "fast", "speed", "quick", "turbo", "lite")
$fastSuffix = "-mini$|_mini$|\.mini$"

$codeModels = $allModels | Where-Object {
    $id = $_.ToLower()
    ($codeKeywords | Where-Object { $id -match $_ }) -ne $null
}

$fastModels = $allModels | Where-Object {
    $id = $_.ToLower()
    ($fastKeywords | Where-Object { $id -match $_ }) -ne $null -or
    $id -match $fastSuffix
}

$specialized = $codeModels + $fastModels | Select-Object -Unique
$generalModels = $allModels | Where-Object { $specialized -notcontains $_ }

Write-Host "   🤖 动态分类:"
Write-Host "     代码类 ($($codeModels.Count) 个): $($codeModels -join ', ')"   | Where-Object { $_ }
Write-Host "     高速类 ($($fastModels.Count) 个): $($fastModels -join ', ')"   | Where-Object { $_ }
Write-Host "     通用类 ($($generalModels.Count) 个): $($generalModels -join ', ')" | Where-Object { $_ }

# ============================================================
# 第三步：按专家类型匹配模型
# ============================================================
function Pick-Model {
    param([string]$ExpertName)

    $codeExpertPattern = @(
        "developer", "architect", "engineer", "programmer", "coder",
        "builder", "maintainer", "automator", "tester",
        "frontend", "backend", "fullstack", "mobile", "devops"
    )
    if ($codeExpertPattern | Where-Object { $ExpertName -match $_ }) {
        if ($codeModels) { return $codeModels | Select-Object -First 1 }
    }

    $fastExpertPattern = @("highspeed", "lightweight", "quick", "fast")
    if ($fastExpertPattern | Where-Object { $ExpertName -match $_ }) {
        if ($fastModels) { return $fastModels | Select-Object -First 1 }
    }

    return $null
}

if ($Model -eq "") {
    $autoModel = Pick-Model -ExpertName $ExpertName
    if ($autoModel) {
        $Model = $autoModel
        Write-Host "   🤖 智能匹配: '$ExpertName' → $Model"
    }
}

# ============================================================
# 第四步：最终模型确认 + Fallback 链
# ============================================================
if ($Model -eq "") {
    Write-Host "   🤖 未指定模型，使用系统默认: $defaultModel"
    $Model = $defaultModel
}

if ($allModels -notcontains $Model -and $Model -ne $defaultModel) {
    Write-Warning "⚠️ 模型 '$Model' 不在可用列表中"
    Write-Host "   → 回退到系统默认: $defaultModel"
    $Model = $defaultModel
}

if ($allModels -notcontains $Model) {
    Write-Warning "⚠️ 系统默认 '$defaultModel' 也不在可用列表中"
    if ($fallbacks) {
        $Model = $fallbacks | Select-Object -First 1
        Write-Host "   → 回退到第一个 fallback: $Model"
    } elseif ($allModels) {
        $Model = $allModels | Select-Object -First 1
        Write-Host "   → 回退到第一个可用模型: $Model"
    } else {
        Write-Error "❌ 没有可用的模型，无法创建临时 Agent"
        exit 1
    }
}

Write-Host "   ✅ 最终模型: $Model"

# ============================================================
# 第五步：创建临时 Agent
# ============================================================
$TS = [int][double]::Parse((Get-Date -UFormat %s))
$AgentId = "temp-$ExpertName-$TS"
$WorkspaceDir = "$env:USERPROFILE\.openclaw\temp\$AgentId"

New-Item -ItemType Directory -Path $WorkspaceDir -Force | Out-Null
Write-Host "📁 创建临时工作区: $WorkspaceDir"

Copy-Item $ExpertFile "$WorkspaceDir\AGENTS.md"
@"
# $ExpertName (Temporary Instance)
emoji: 🧑‍💻
description: 由 Master Orchestrator 按需创建的临时专家 Agent
model: $Model
"@ | Out-File -FilePath "$WorkspaceDir\IDENTITY.md" -Encoding utf8

@"
你是根据 Agency 专家定义动态创建的临时 Agent。
你的角色和职责已写入 AGENTS.md。
请按该定义完成分配的任务。
"@ | Out-File -FilePath "$WorkspaceDir\SOUL.md" -Encoding utf8

Write-Host "📝 专家定义已写入: $WorkspaceDir\AGENTS.md"

$addArgs = @(
    "agents", "add", $AgentId,
    "--workspace", "$WorkspaceDir",
    "--model", "$Model",
    "--non-interactive"
)

$result = & openclaw $addArgs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 临时 Agent 注册成功: $AgentId"
    $output = @{
        agentId   = $AgentId
        model     = $Model
        workspace = $WorkspaceDir
    }
    Write-Output ($output | ConvertTo-Json -Compress)
} else {
    Write-Error "❌ OpenClaw 注册 Agent 失败: $result"
    Remove-Item -Path $WorkspaceDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
