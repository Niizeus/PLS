@echo off
chcp 65001 >nul
title PLS - Lancement du jeu
cd /d "%~dp0"

echo ==================================
echo         PLS - Lancement
echo ==================================
echo.

REM --- 1. Verifie que Node.js est installe ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js n'est pas installe ^(ou pas dans le PATH^).
  echo Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

REM --- 2. Installe les librairies si c'est la premiere fois ---
if not exist "node_modules" (
  echo Premiere utilisation : installation des librairies...
  echo Ca peut prendre 1 a 2 minutes, c'est normal.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERREUR] L'installation a echoue. Verifie ta connexion internet.
    pause
    exit /b 1
  )
  echo.
)

REM --- 3. Lance le jeu et ouvre le navigateur automatiquement ---
echo Demarrage du jeu... le navigateur va s'ouvrir tout seul.
echo Pour ARRETER le jeu : ferme cette fenetre ^(ou Ctrl + C^).
echo.
call npm run dev -- --open

REM Si le serveur s'arrete/plante, on garde la fenetre ouverte pour lire le message.
echo.
echo Le serveur s'est arrete.
pause
