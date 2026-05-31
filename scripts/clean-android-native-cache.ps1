# Supprime les caches CMake/Gradle natifs (chemins longs empoisonnes ou builds corrompus).
param(
    [string]$Root = $env:STAGESTOCK_SHORT_ROOT
)

$ErrorActionPreference = 'Stop'
if (-not $Root) {
    $Root = Split-Path -Parent $PSScriptRoot
}

$removed = 0
foreach ($rel in @('android\.gradle', 'android\app\build', 'android\build', 'android\.cxx')) {
    $p = Join-Path $Root $rel
    if (Test-Path $p) {
        Remove-Item -LiteralPath $p -Recurse -Force
        $removed++
    }
}

Get-ChildItem -Path (Join-Path $Root 'node_modules') -Filter '.cxx' -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
        $removed++
    }

Write-Host "[clean-native] $removed cache(s) natif(s) supprime(s)."
