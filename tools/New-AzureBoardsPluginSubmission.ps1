param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutputDirectory = (Join-Path $RepositoryRoot "artifacts"),
  [string]$PackageName = "azure-board-plugin-codex-submission.zip"
)

$ErrorActionPreference = "Stop"

$pluginRoot = Join-Path $RepositoryRoot "plugins\azure-boards"
if (-not (Test-Path (Join-Path $pluginRoot ".codex-plugin\plugin.json"))) {
  throw "Plugin manifest not found at plugins\azure-boards\.codex-plugin\plugin.json"
}

$stageRoot = Join-Path $OutputDirectory "azure-board-plugin-codex"
$zipPath = Join-Path $OutputDirectory $PackageName

if (Test-Path $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

$includePaths = @(
  ".app.json",
  ".codex-plugin",
  ".env.production.example",
  ".mcp.json",
  "assets",
  "chatgpt-app-submission.json",
  "demo",
  "Dockerfile",
  "docs",
  "policy-packs",
  "production-publisher-inputs.example.json",
  "README.md",
  "scripts\dist",
  "scripts\package.json",
  "scripts\package-lock.json",
  "skills",
  "ui"
)

foreach ($relativePath in $includePaths) {
  $source = Join-Path $pluginRoot $relativePath
  if (-not (Test-Path $source)) {
    throw "Required submission path missing: $relativePath"
  }

  $target = Join-Path $stageRoot $relativePath
  $targetParent = Split-Path -Parent $target
  if ($targetParent -and -not (Test-Path $targetParent)) {
    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
  }

  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

$excludedPatterns = @(
  "scripts\test\*",
  "scripts\src\*",
  "scripts\live\*",
  "scripts\tmp-test-store\*",
  "scripts\node_modules\*",
  "scripts\*.mjs",
  "azure-devops-extension\*"
)

foreach ($pattern in $excludedPatterns) {
  Get-ChildItem -LiteralPath $stageRoot -Recurse -Force |
    Where-Object {
      $relative = $_.FullName.Substring($stageRoot.Length).TrimStart("\")
      $relative -like $pattern
    } |
    Sort-Object FullName -Descending |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
}

$requiredFiles = @(
  ".codex-plugin\plugin.json",
  ".mcp.json",
  ".app.json",
  "chatgpt-app-submission.json",
  "scripts\dist\server.js",
  "scripts\dist\hostedServer.js",
  "scripts\dist\productOperatingSystem.js",
  "assets\screenshots\decision-pack.png",
  "assets\screenshots\approval-workflow.png",
  "docs\privacy-policy.md",
  "docs\terms-of-service.md"
)

foreach ($relativePath in $requiredFiles) {
  if (-not (Test-Path (Join-Path $stageRoot $relativePath))) {
    throw "Submission artifact is missing required file: $relativePath"
  }
}

$fileCount = (Get-ChildItem -LiteralPath $stageRoot -Recurse -File | Measure-Object).Count
if ($fileCount -gt 128) {
  throw "Submission artifact has $fileCount files, exceeding the limit of 128."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Created $zipPath"
Write-Host "Submission file count: $fileCount"
