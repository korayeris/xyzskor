$ErrorActionPreference = 'Stop'

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCommand) {
    $nodeExe = $nodeCommand.Source
} else {
    throw 'Node.js bulunamadı. Node.js 20 veya daha yeni bir sürüm kurup tekrar deneyin.'
}

& $nodeExe (Join-Path $PSScriptRoot 'check.mjs')
if ($LASTEXITCODE -ne 0) {
    throw 'JavaScript sözdizimi kontrolü başarısız.'
}
