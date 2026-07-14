@echo off
chcp 65001 >nul
cd /d "%~dp0"
title CATRACK Pro - build APK release
set GRADLE_USER_HOME=C:\gc
set TEMP=C:\tmp
set TMP=C:\tmp
set GRADLE_OPTS=-Djava.io.tmpdir=C:\tmp
if not exist C:\gc mkdir C:\gc
if not exist C:\tmp mkdir C:\tmp
echo Build APK via miroir C:\SSBuild (chemins courts Windows)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\android-assemble-release.ps1" %*
if errorlevel 1 (
  echo.
  echo Echec. Essayez : BUILD-APK.bat -CleanNative
  pause
  exit /b 1
)
pause
