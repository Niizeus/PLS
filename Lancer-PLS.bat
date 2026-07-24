@echo off
chcp 65001 >nul
title PLS - Lancement du jeu
cd /d "%~dp0"

echo ==================================
echo         PLS - Lancement
echo ==================================
echo.

REM ============================================================
REM  1. Node.js est-il installe ?  (sinon : installation auto)
REM ============================================================
where node >nul 2>nul
if not errorlevel 1 goto node_ok

echo [!] Node.js n'est pas installe sur ce PC.
echo     Il est necessaire pour faire tourner le jeu.
echo.

REM winget = l'installeur integre a Windows 10/11
where winget >nul 2>nul
if errorlevel 1 goto no_winget

set /p rep="Installer Node.js automatiquement maintenant ? (O/N, defaut O) : "
if /i "%rep%"=="N" goto install_manual

echo.
echo Installation de Node.js en cours...
echo (Windows peut afficher une fenetre pour demander l'autorisation : accepte.)
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements

REM On rafraichit le PATH de cette fenetre pour trouver node tout de suite.
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"

where node >nul 2>nul
if not errorlevel 1 goto node_ok

echo.
echo Node.js a ete installe, mais il faut RELANCER ce fichier pour qu'il
echo soit pris en compte.
echo    -^> Ferme cette fenetre et double-clique a nouveau sur Lancer-PLS.bat
echo (Si ca ne marche toujours pas, installe-le a la main depuis https://nodejs.org)
echo.
pause
exit /b 0

:no_winget
echo Ton Windows n'a pas "winget" (installeur automatique).
:install_manual
echo.
echo Installe Node.js (version LTS) a la main depuis :
echo     https://nodejs.org
echo puis relance ce fichier.
echo.
start "" "https://nodejs.org"
pause
exit /b 1

:node_ok
echo Node.js : OK
echo.

REM ============================================================
REM  2. Les librairies du jeu sont-elles installees ?
REM ============================================================
if not exist "node_modules\.bin\vite.cmd" (
  echo Premiere utilisation : installation des librairies du jeu...
  echo Ca peut prendre 1 a 2 minutes, c'est normal.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERREUR] L'installation des librairies a echoue.
    echo Verifie ta connexion internet, puis relance ce fichier.
    pause
    exit /b 1
  )
  echo.
)

REM ============================================================
REM  3. Lancer le jeu (ouvre le navigateur automatiquement)
REM ============================================================
echo Demarrage du jeu... le navigateur va s'ouvrir tout seul.
echo Pour ARRETER le jeu : ferme cette fenetre ^(ou Ctrl + C^).
echo.
call npm run dev -- --open

echo.
echo Le serveur s'est arrete.
pause
