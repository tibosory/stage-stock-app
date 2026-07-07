# Build APK release hors IDE — cache Gradle ultra-court (C:\gc).
$ErrorActionPreference = 'Stop'

$gradleRoot = 'C:\gc'
$env:GRADLE_USER_HOME = $gradleRoot
$env:TEMP = 'C:\tmp'
$env:TMP = 'C:\tmp'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:GRADLE_OPTS = '-Xmx6144m -XX:MaxMetaspaceSize=1536m'
$env:STAGESTOCK_BUILD_MIRROR = 'C:\SSBuild'
$env:STAGESTOCK_PROJECT_ROOT = 'C:\dev\SStock\StageStock'
New-Item -ItemType Directory -Force -Path $gradleRoot, $env:TEMP | Out-Null

$LogFile = 'C:\dev\SStock\StageStock\build-output\build-apk.log'
New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null
Start-Transcript -Path $LogFile -Force | Out-Null

try {
    Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"

    & 'C:\dev\SStock\StageStock\scripts\clean-android-native-cache.ps1' -Root 'C:\SSBuild'

    Set-Location 'C:\SSBuild\android'
    if (Test-Path '.\gradlew.bat') {
        & .\gradlew.bat -g C:\gc --stop 2>&1 | Out-Null
    }

    Set-Location 'C:\dev\SStock\StageStock'
    & 'C:\dev\SStock\StageStock\scripts\android-assemble-release.ps1' -SkipPrebuild -CleanNative
    if ($LASTEXITCODE -ne 0) { throw "android-assemble-release exit $LASTEXITCODE" }
    Write-Host 'BUILD OK'
    exit 0
} catch {
    Write-Host "BUILD FAIL: $_"
    exit 1
} finally {
    Stop-Transcript | Out-Null
}
