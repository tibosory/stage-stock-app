param(
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (!(Test-Path $adb)) {
  throw "ADB introuvable: $adb"
}

$apk = Resolve-Path (Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\release\app-release.apk") -ErrorAction SilentlyContinue
if (!$apk) {
  throw "APK release introuvable. Lance d'abord: npm run android:assemble-release"
}

$targetArgs = @()
if ($Serial.Trim()) {
  $targetArgs += @("-s", $Serial.Trim())
}

& $adb devices -l
& $adb @targetArgs install -r $apk.Path

# Double lancement: contourne les fermetures immediates sur certains appareils Samsung apres install.
& $adb @targetArgs shell monkey -p com.vellein.stagestock -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 2
& $adb @targetArgs shell monkey -p com.vellein.stagestock -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "Installation terminee et application lancee."
