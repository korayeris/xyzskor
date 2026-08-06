$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = 'C:\Users\koray\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCommand) {
    $nodeExe = $nodeCommand.Source
} elseif (Test-Path -LiteralPath $bundledNode) {
    $nodeExe = $bundledNode
} else {
    throw 'Node.js bulunamadı. Codex çalışma ortamını yeniden açıp tekrar deneyin.'
}

& $nodeExe (Join-Path $PSScriptRoot 'check.mjs')
if ($LASTEXITCODE -ne 0) {
    throw 'JavaScript sözdizimi kontrolü başarısız.'
}
