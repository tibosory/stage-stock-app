# Build APK release depuis miroir court C:\SSBuild (source: C:\dev\SStock\StageStock).
param(
    [switch]$CleanNative,
    [switch]$SkipPrebuild,
    [string]$MirrorRoot = $env:STAGESTOCK_BUILD_MIRROR,
    [string]$ProjectRoot = $env:STAGESTOCK_PROJECT_ROOT
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot

# Forcer les chemins courts AVANT sync npm / gradle (évite le sandbox Cursor).
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { 'C:\gc' }
$env:GRADLE_USER_HOME = $gradleHome
$env:TEMP = 'C:\tmp'
$env:TMP = 'C:\tmp'
$env:GRADLE_OPTS = '-Djava.io.tmpdir=C:\tmp'
New-Item -ItemType Directory -Force -Path $gradleHome.TrimEnd('\'), $env:TEMP | Out-Null
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
if (-not (Test-Path $env:ANDROID_HOME)) {
    throw "SDK Android introuvable ($($env:ANDROID_HOME)). Installez Android Studio ou definissez ANDROID_HOME."
}
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

. (Join-Path $ScriptDir 'ensure-android-short-path.ps1') -MirrorRoot $MirrorRoot -ProjectRoot $ProjectRoot

$ShortRoot = $global:StageStockShortRoot
$ProjectRoot = $global:StageStockProjectRoot
$env:STAGESTOCK_SHORT_ROOT = $ShortRoot
$env:NODE_ENV = 'production'

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
    Ensure-AndroidGradleReleaseTuning -Root $ShortRoot | Out-Null
}

Ensure-AndroidLocalProperties -Root $ShortRoot -SdkRoot $env:ANDROID_HOME

Set-Location (Join-Path $ShortRoot 'android')
$stale = Clear-StaleJsBundle -Root $ShortRoot
Write-Host "[build] Projet source: $ProjectRoot"
Write-Host "[build] Build root: $ShortRoot"
Write-Host "[build] GRADLE_USER_HOME=$gradleHome"
Write-Host '[build] gradlew assembleRelease (arm64-v8a)...'

$gradleArgs = @(
    "-g", $gradleHome,
    '--no-daemon',
    '--no-build-cache',
    '-PreactNativeArchitectures=arm64-v8a',
    'assembleRelease',
    '-x', 'lintVitalAnalyzeRelease',
    '-x', 'lintVitalReportRelease',
    '-x', 'lintVitalRelease'
)
if ($stale) {
    $gradleArgs = @(
        "-g", $gradleHome,
        '--no-daemon',
        '--no-build-cache',
        '-PreactNativeArchitectures=arm64-v8a',
        ':app:createBundleReleaseJsAndAssets',
        'assembleRelease',
        '-x', 'lintVitalAnalyzeRelease',
        '-x', 'lintVitalReportRelease',
        '-x', 'lintVitalRelease'
    )
}

$logFile = Join-Path $env:TEMP 'gradle-assemble-release.log'
# stderr Gradle/javac ("Note:") ne doit pas abort PowerShell (ErrorAction Stop).
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& .\gradlew.bat @gradleArgs 2>&1 | Tee-Object -FilePath $logFile
$gradleExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($gradleExit -ne 0) {
    Write-Host ''
    Write-Host '=== assembleRelease a echoue ===' -ForegroundColor Red
    Write-Host 'Le message "Deprecated Gradle features" n''est PAS la cause.'
    Write-Host 'Cherchez la ligne "* What went wrong:" dans la sortie ci-dessus.'
    Write-Host ''
    Write-Host 'Causes frequentes :'
    Write-Host '  - Chemins Windows > 260 car. : ne pas lancer gradlew depuis StageStock\android'
    Write-Host '    -> utiliser npm run android:assemble-release (miroir C:\SSBuild)'
    Write-Host '  - SDK Android : ANDROID_HOME ou local.properties'
    Write-Host '  - Cache Gradle corrompu : npm run android:assemble-release:clean'
    if (Test-Path $logFile) {
        $what = Select-String -Path $logFile -Pattern 'What went wrong:|Filename longer than|SDK location not found' |
            Select-Object -Last 3
        if ($what) {
            Write-Host ''
            Write-Host 'Extrait du journal :'
            $what | ForEach-Object { Write-Host $_.Line }
        }
    }
    throw 'assembleRelease a echoue.'
}

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
