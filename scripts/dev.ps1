$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 4173
$bundledPython = 'C:\Users\koray\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue

if ($pythonCommand) {
    $pythonExe = $pythonCommand.Source
} elseif (Test-Path -LiteralPath $bundledPython) {
    $pythonExe = $bundledPython
} else {
    throw 'Python bulunamadı. Codex çalışma ortamını yeniden açıp tekrar deneyin.'
}

Write-Host "XYZSkor: http://127.0.0.1:$port"
& $pythonExe -m http.server $port --bind 127.0.0.1 --directory $projectRoot

