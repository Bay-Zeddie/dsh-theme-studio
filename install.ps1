#Requires -Version 5.1
<#
.SYNOPSIS
  dsh-theme-studio（主题工坊）一键安装脚本。

.DESCRIPTION
  把本地目录以 link: 方式装进 DSH 的指定 profile（桌面端用法，
  也可以直接在应用的「插件」页以本地路径安装），
  随后需要重启应用才生效。
  不下载任何东西，纯本地操作；改动只落在
    $DSH_HOME\profiles\<profile>\package.json
    $DSH_HOME\profiles\<profile>\cordis.patch.yml
  两处，改动前先自动备份。

.USAGE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile desktop
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Profile
)

$ErrorActionPreference = 'Stop'

$Package = 'dsh-theme-studio'

function Info([string]$msg) { Write-Host "[$Package] $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "[$Package] $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "[$Package] $msg" -ForegroundColor Red; throw $msg }

if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
  Fail '未找到 dsh 命令。请先安装 DeepSeek Harness：npm install -g @deepseek-ai/dsh（需要 Node.js >= 20）'
}

# link: 目标必须是正斜杠的绝对路径，Windows 下反斜杠会让 pnpm 解析失败。
$target = ($PSScriptRoot -replace '\\', '/')
$spec = "link:$target"

Info "安装来源：$spec"
Info "目标 profile：$Profile"

# 改动只落在 profile 的 package.json / cordis.patch.yml 两处：动手前各留一份
# 带时间戳的备份（.DESCRIPTION 承诺的"改动前先自动备份"由这里兑现）。
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $homeDir "profiles/$Profile"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($name in @('package.json', 'cordis.patch.yml')) {
  $file = Join-Path $profileDir $name
  if (Test-Path $file) {
    Copy-Item $file "$file.bak-$stamp"
    Info "已备份 $name -> $name.bak-$stamp"
  }
}

# pnpm 是 dsh plugin 的底层实现，缺了就补（版本交给 corepack/npm 默认）。
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Info 'pnpm 不在 PATH 上，尝试 corepack 激活…'
    $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { corepack prepare pnpm@latest --activate 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
  }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Info 'corepack 不可用，改用 npm 全局安装 pnpm…'
    npm install -g pnpm | Out-Null
  }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Fail 'pnpm 安装失败，请手动执行 npm install -g pnpm 后重试'
  }
}

dsh plugin --profile $Profile add $spec
if ($LASTEXITCODE -ne 0) { Fail 'add 失败，请看上面的输出' }

Ok @"

$Package 已装入 profile「$Profile」。

  生效：  重启应用（桌面端 Host 半只在启动时装载）
  验证：  dsh --profile $Profile --dump-config | Select-String $Package
          界面右下角应出现圆形浮动按钮（点开即主题工坊模态），
          设置里应出现「主题工坊」独立分区
  卸载：  powershell -File .\uninstall.ps1 -Profile $Profile
         （或 dsh plugin --profile $Profile remove $Package）
"@
