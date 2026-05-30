# 首次使用：在 PowerShell 中执行一次 gh auth login 并完成浏览器登录
# 然后在本仓库根目录运行： .\scripts\publish-to-github.ps1

$ErrorActionPreference = "Stop"
$RepoName = "yulinglu-card-game"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "请先登录 GitHub："
    gh auth login -h github.com -p https -w
}

if (git remote get-url origin 2>$null) {
    Write-Host "已有远程 origin，正在推送..."
    git push -u origin main
} else {
    Write-Host "正在创建仓库并推送: $RepoName"
    gh repo create $RepoName --public --source=. --remote=origin --push --description "寓灵录 · 网页版仙侠卡牌游戏"
}

$owner = (gh api user -q .login)
$url = "https://github.com/$owner/$RepoName"
Write-Host ""
Write-Host "仓库链接: $url"
