# Prepare un chemin court pour builds Android (miroir physique + npm ci incremental).
param(
    [string]$MirrorRoot = $env:STAGESTOCK_BUILD_MIRROR,
    [string]$ProjectRoot = $env:STAGESTOCK_PROJECT_ROOT
)

$DefaultProjectRoot = 'C:\dev\SStock\StageStock'
if (-not $MirrorRoot) { $MirrorRoot = 'C:\SSBuild' }

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) {
    if (Test-Path $DefaultProjectRoot) {
        $ProjectRoot = (Resolve-Path $DefaultProjectRoot).Path
    } else {
        $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

function Sync-SourceMirror {
    param([string]$Source, [string]$Dest)
    if (-not (Test-Path $Dest)) {
        New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    }
    $exclude = @('node_modules', 'android', '.expo', '.git', 'build-output')
    $args = @($Source, $Dest, '/MIR')
    foreach ($x in $exclude) { $args += '/XD'; $args += $x }
    $args += @('/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np')
    & robocopy @args | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "robocopy a echoue (code $LASTEXITCODE)."
    }
}

function Ensure-SourceRootStamp {
    param([string]$Source, [string]$Dest)
    $stamp = Join-Path $Dest '.stagestock-source-root.txt'
    $prev = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { '' }
    if ($prev -and $prev -ne $Source) {
        Write-Host "[short-path] Projet source change ($prev -> $Source) -> purge android du miroir"
        $android = Join-Path $Dest 'android'
        if (Test-Path $android) { Remove-Item -LiteralPath $android -Recurse -Force }
    }
    Set-Content -Path $stamp -Value $Source -NoNewline
}

function Ensure-Deps {
    param([string]$Root)
    Set-Location $Root
    $stamp = Join-Path $Root 'node_modules\.stagestock-lock-stamp'
    $lock = Join-Path $Root 'package-lock.json'
    $need = -not (Test-Path (Join-Path $Root 'node_modules\expo\package.json'))
    if (-not $need) {
        if (-not (Test-Path $stamp)) {
            # Aucun temoin fiable : impossible de garantir que node_modules reflete
            # package-lock.json (ex. dependance ajoutee depuis le dernier build) -> on reinstalle.
            $need = $true
        } elseif (Test-Path $lock) {
            $need = (Get-Item $lock).LastWriteTimeUtc -gt (Get-Item $stamp).LastWriteTimeUtc
        }
    }
    if ($need) {
        Write-Host "[short-path] npm ci..."
        npm ci --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) { throw 'npm ci a echoue.' }
        Copy-Item $lock $stamp -Force
    }
}

function Ensure-PrebuildStamp {
    param([string]$Root)
    $stamp = Join-Path $Root 'android\.stagestock-prebuild-stamp'
    $inputs = @(
        (Join-Path $Root 'app.json'),
        (Join-Path $Root 'package.json'),
        (Join-Path $Root 'package-lock.json')
    )
    $newest = ($inputs | Where-Object { Test-Path $_ } | ForEach-Object { Get-Item $_ } |
        Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
    $need = -not (Test-Path (Join-Path $Root 'android\app\build.gradle'))
    if (-not $need -and (Test-Path $stamp)) {
        $need = $newest -gt (Get-Item $stamp).LastWriteTimeUtc
    } elseif (-not $need) {
        $gradle = Join-Path $Root 'android\app\build.gradle'
        $need = $newest -gt (Get-Item $gradle).LastWriteTimeUtc
    }
    if (-not $need) {
        $need = -not (Test-AndroidGradleReleaseTuning -Root $Root)
    }
    return @{ Need = $need; Stamp = $stamp }
}

function Test-AndroidGradleReleaseTuning {
    param([string]$Root)
    $file = Join-Path $Root 'android\gradle.properties'
    if (-not (Test-Path $file)) { return $false }
    $raw = Get-Content $file -Raw
    return $raw -match 'reactNativeArchitectures=arm64-v8a(\s|$|\r?\n)'
}

function Ensure-AndroidGradleReleaseTuning {
    param([string]$Root)
    $file = Join-Path $Root 'android\gradle.properties'
    if (-not (Test-Path $file)) { return $false }
    $changed = -not (Test-AndroidGradleReleaseTuning -Root $Root)

    $map = [ordered]@{
        'reactNativeArchitectures'       = 'arm64-v8a'
        'org.gradle.parallel'            = 'true'
        'org.gradle.caching'             = 'true'
        'org.gradle.jvmargs'             = '-Xmx6144m -XX:MaxMetaspaceSize=1536m -Djava.io.tmpdir=C:/tmp'
        'android.lint.checkReleaseBuilds' = 'false'
        'android.lint.abortOnError'      = 'false'
    }
    $lines = @(Get-Content $file)
    $out = [System.Collections.Generic.List[string]]::new()
    $out.AddRange([string[]]$lines)
    foreach ($key in $map.Keys) {
        $value = "$key=$($map[$key])"
        $found = $false
        for ($i = 0; $i -lt $out.Count; $i++) {
            if ($out[$i] -match "^$([regex]::Escape($key))=") {
                $out[$i] = $value
                $found = $true
                break
            }
        }
        if (-not $found) { $out.Add($value) }
    }
    Set-Content -Path $file -Value ($out.ToArray())
    Write-Host '[short-path] gradle.properties ajuste (arm64-v8a + cache Gradle + lint off)'
    return $changed
}

function Ensure-AndroidLocalProperties {
    param([string]$Root, [string]$SdkRoot)
    if (-not (Test-Path $SdkRoot)) {
        throw "SDK Android introuvable: $SdkRoot. Installez Android Studio ou definissez ANDROID_HOME."
    }
    $androidDir = Join-Path $Root 'android'
    if (-not (Test-Path $androidDir)) { return }
    $file = Join-Path $androidDir 'local.properties'
    $sdkPath = $SdkRoot -replace '\\', '/'
    Set-Content -Path $file -Value "sdk.dir=$sdkPath" -Encoding ascii
    Write-Host "[short-path] local.properties -> $SdkRoot"
}

function Get-LatestSourceWriteUtc {
    param([string]$Root)
    $inputs = @(
        (Join-Path $Root 'App.tsx'),
        (Join-Path $Root 'app.json'),
        (Join-Path $Root 'package.json')
    )
    $latest = ($inputs | Where-Object { Test-Path $_ } | ForEach-Object { Get-Item $_ } |
        Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
    $srcLatest = Get-ChildItem -Path (Join-Path $Root 'src') -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if ($srcLatest -and $srcLatest.LastWriteTimeUtc -gt $latest) {
        $latest = $srcLatest.LastWriteTimeUtc
    }
    return $latest
}

function Clear-StaleJsBundle {
    param([string]$Root)
    $bundleDir = Join-Path $Root 'android\app\build\generated\assets\createBundleReleaseJsAndAssets'
    $bundleFile = Join-Path $bundleDir 'index.android.bundle'
    if (-not (Test-Path $bundleFile)) { return $true }
    $sourceLatest = Get-LatestSourceWriteUtc -Root $Root
    $bundleTime = (Get-Item $bundleFile).LastWriteTimeUtc
    if ($sourceLatest -le $bundleTime) { return $false }
    Write-Host "[build] Sources plus recentes que le bundle JS ($sourceLatest > $bundleTime) -> regeneration forcee"
    Remove-Item -LiteralPath (Join-Path $Root 'android\app\build\generated\assets') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $Root 'android\app\build\intermediates\sourcemaps') -Recurse -Force -ErrorAction SilentlyContinue
    return $true
}

Write-Host "[short-path] Projet source: $ProjectRoot"
Write-Host "[short-path] Sync sources -> $MirrorRoot"
Ensure-SourceRootStamp -Source $ProjectRoot -Dest $MirrorRoot
Sync-SourceMirror -Source $ProjectRoot -Dest $MirrorRoot
Ensure-Deps -Root $MirrorRoot

$global:StageStockShortRoot = $MirrorRoot
$global:StageStockProjectRoot = $ProjectRoot
$pre = Ensure-PrebuildStamp -Root $MirrorRoot
$global:StageStockNeedPrebuild = $pre.Need
$global:StageStockPrebuildStamp = $pre.Stamp

Write-Host "[short-path] Build root: $MirrorRoot"
