<#
.SYNOPSIS
  回收由 create_temp_expert.ps1 创建的临时 OpenClaw Agent
.DESCRIPTION
  Phase 4 统一清理阶段调用。
  从 OpenClaw 注销临时 Agent 并物理销毁其沙盒工作区。
  内置安全白名单：只允许删除以 "temp-" 开头的 Agent。
.PARAMETER AgentId
  要回收的临时 Agent ID（如 temp-frontend-developer-1713992400）
.EXAMPLE
  .\cleanup_temp.ps1 -AgentId "temp-frontend-developer-1713992400"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$AgentId
)

# ---------- 安全白名单：只允许回收 temp- 前缀的 Agent ----------
if ($AgentId -notmatch "^temp-") {
    Write-Error "🛡️ 安全拦截：只能回收以 temp- 开头的临时 Agent（收到: $AgentId）"
    exit 1
}

Write-Host "🧹 正在回收临时专家: $AgentId ..."

# ---------- 从 OpenClaw 注销 ----------
$result = & openclaw agents delete $AgentId --force 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 已从 OpenClaw 注销: $AgentId"
} else {
    Write-Warning "⚠️ OpenClaw 注销可能未完全成功: $result"
}

# ---------- 物理销毁沙盒工作区 ----------
$WorkspaceDir = "$env:USERPROFILE\.openclaw\temp\$AgentId"
if (Test-Path $WorkspaceDir) {
    Remove-Item -Path $WorkspaceDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $WorkspaceDir) {
        Write-Warning "⚠️ 沙盒目录未能完全删除: $WorkspaceDir"
    } else {
        Write-Host "✅ 沙盒已销毁: $WorkspaceDir"
    }
} else {
    Write-Host "📁 沙盒目录不存在，可能已被清理: $WorkspaceDir"
}

Write-Host "✅ 回收完毕。"
