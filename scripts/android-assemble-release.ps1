# Build APK release depuis miroir court C:\SSBuild (source: C:\dev\SStock\StageStock).
param(
    [switch]$CleanNative,
    [switch]$SkipPrebuild,
    [string]$MirrorRoot = $env:STAGESTOCK_BUILD_MIRROR,
    [string]$ProjectRoot = $env:STAGESTOCK_PROJECT_ROOT
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
. (Join-Path $ScriptDir 'ensure-android-short-path.ps1') -MirrorRoot $MirrorRoot -ProjectRoot $ProjectRoot

$ShortRoot = $global:StageStockShortRoot
$ProjectRoot = $global:StageStockProjectRoot
$env:STAGESTOCK_SHORT_ROOT = $ShortRoot
$env:NODE_ENV = 'production'

if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

if ($CleanNative) {
    & (Join-Path $ScriptDir 'clean-android-native-cache.ps1') -Root $ShortRoot
}

Set-Location $ShortRoot

$needPrebuild = ($global:StageStockNeedPrebuild -or -not (Test-AndroidGradleReleaseTuning -Root $ShortRoot)) -and -not $SkipPrebuild
if ($needPrebuild) {
    Write-Host '[build] expo prebuild android --clean...'
    npx expo prebuild --platform android --clean --no-install
    if ($LASTEXITCODE -ne 0) { throw 'expo prebuild a echoue.' }
    Ensure-AndroidGradleReleaseTuning -Root $ShortRoot | Out-Null
    Set-Content -Path $global:StageStockPrebuildStamp -Value (Get-Date).ToUniversalTime().ToString('o')
} else {
    if (Ensure-AndroidGradleReleaseTuning -Root $ShortRoot) {
        & (Join-Path $ScriptDir 'clean-android-native-cache.ps1') -Root $ShortRoot
    }
}

Set-Location (Join-Path $ShortRoot 'android')
$stale = Clear-StaleJsBundle -Root $ShortRoot
Write-Host "[build] Projet source: $ProjectRoot"
Write-Host "[build] Build root: $ShortRoot"
Write-Host '[build] gradlew assembleRelease (arm64-v8a)...'

$gradleArgs = @(
    '-PreactNativeArchitectures=arm64-v8a',
    'assembleRelease'
)
if ($stale) {
    $gradleArgs = @('-PreactNativeArchitectures=arm64-v8a', ':app:createBundleReleaseJsAndAssets', 'assembleRelease')
}

& .\gradlew.bat @gradleArgs
if ($LASTEXITCODE -ne 0) { throw 'assembleRelease a echoue.' }

$apk = Get-ChildItem -Path 'app\build\outputs\apk\release\*.apk' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw 'APK introuvable apres assembleRelease.' }

$outDir = Join-Path $ProjectRoot 'build-output'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$dest = Join-Path $outDir 'CATRACK-Pro-release.apk'
Copy-Item -LiteralPath $apk.FullName -Destination $dest -Force
Copy-Item -LiteralPath $apk.FullName -Destination (Join-Path $env:USERPROFILE 'Desktop\CATRACK-Pro-release.apk') -Force

Write-Host ''
Write-Host "APK: $dest"
Write-Host "Bureau: $(Join-Path $env:USERPROFILE 'Desktop\CATRACK-Pro-release.apk')"
Write-Host ("Taille: {0:N1} Mo" -f ($apk.Length / 1MB))
Write-Host "Build root: $ShortRoot"
