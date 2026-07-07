@echo off
chcp 65001 >nul
title Activer chemins longs Windows (admin requis)
echo.
echo  Active les chemins ^> 260 caracteres (requis pour build Android RN).
echo  Redemarrage Windows recommande apres.
echo.
reg add HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled /t REG_DWORD /d 1 /f
if errorlevel 1 (
  echo ECHEC — lancez ce fichier en clic droit ^> Executer en tant qu'administrateur.
) else (
  echo OK — LongPathsEnabled=1
)
echo.
pause
