@echo off
chcp 65001 >nul
title Build CATRACK Pro APK
echo.
echo  Build CATRACK Pro (APK release)
echo  Duree estimee : 15 a 40 minutes
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk-standalone.ps1"
if errorlevel 1 (
  echo.
  echo  ECHEC — voir build-output\build-apk.log
  pause
  exit /b 1
)
echo.
echo  APK copiee sur le Bureau : CATRACK-Pro-release.apk
pause
