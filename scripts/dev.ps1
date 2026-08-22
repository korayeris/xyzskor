$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 4173
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { $null }

if ($nodeExe) {
    Write-Host "XYZSkor: http://127.0.0.1:$port"
    & $nodeExe (Join-Path $PSScriptRoot 'dev-server.mjs')
    exit $LASTEXITCODE
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
$pythonArgs = @('-m', 'http.server', $port, '--bind', '127.0.0.1', '--directory', $projectRoot)

if ($pythonCommand) {
    $pythonExe = $pythonCommand.Source
} else {
    $pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $pythonLauncher) {
        throw 'Python 3 bulunamadı. python.org üzerinden Python 3 kurup tekrar deneyin.'
    }
    $pythonExe = $pythonLauncher.Source
    $pythonArgs = @('-3') + $pythonArgs
}

Write-Host "XYZSkor: http://127.0.0.1:$port"
& $pythonExe @pythonArgs
