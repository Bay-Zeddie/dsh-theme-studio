#Requires -Version 5.1
<#
.SYNOPSIS
  dsh-theme-studio 卸载脚本：移除 profile 里的插件行，可选清理数据目录。

.USAGE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -PurgeData
#>
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [switch]$PurgeData
)

$ErrorActionPreference = 'Stop'

$Package = 'dsh-theme-studio'

function Info([string]$msg) { Write-Host "[$Package] $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "[$Package] $msg" -ForegroundColor Green }

if (Get-Command dsh -ErrorAction SilentlyContinue) {
  Info "从 profile「$Profile」移除插件…"
  dsh plugin --profile $Profile remove $Package
  if ($LASTEXITCODE -ne 0) { Write-Host "[$Package] remove 返回非零，可能本来就没装" -ForegroundColor Yellow }
} else {
  Write-Host "[$Package] 未找到 dsh 命令，跳过 profile 清理" -ForegroundColor Yellow
}

if ($PurgeData) {
  $root = if ($env:DSH_THEME_STUDIO_HOME) { $env:DSH_THEME_STUDIO_HOME }
          elseif ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'theme-studio' }
          else { Join-Path $env:USERPROFILE '.dsh\theme-studio' }
  if ((Split-Path -Leaf $root) -ne 'theme-studio') {
    Write-Host "[$Package] 数据目录名不是 theme-studio（$root），拒绝递归删除 —— 请人工确认后手动清理" -ForegroundColor Yellow
  } elseif (Test-Path $root) {
    Info "删除数据目录：$root"
    Remove-Item -Recurse -Force $root
    Ok '数据目录已删除（上传的图片 / 视频 / 字体一并清除）'
  } else {
    Ok '没有数据目录需要清理'
  }
} else {
  Ok @"
已卸载插件引用。数据目录仍保留（你的主题配置与上传素材都在里面）：
  默认位置  %DSH_HOME%\theme-studio 或 %USERPROFILE%\.dsh\theme-studio
  一并删除  重跑本脚本并加 -PurgeData
重新安装后原主题会自动恢复。
"@
}

Write-Host ''
Write-Host "记得重启应用让改动生效（桌面端 Host 半只在启动时装载）。" -ForegroundColor Cyan
