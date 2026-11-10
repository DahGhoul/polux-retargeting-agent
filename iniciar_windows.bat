@echo off
title Polux Retargeting Agent - LEAD a PAYER (Diego y Ronaldo)
echo ================================================================
echo   POLUX RETARGETING AGENT - WINDOWS LAUNCHER (LEAD -^> PAYER)
echo   Autores: Diego Cuba ^& Ronaldo Robles Romero
echo ================================================================
cd /d "%~dp0"

if not exist "node_modules" (
  echo [1/2] Instalando dependencias reales ^(Baileys WhatsApp, Nodemailer, MSSQL^)...
  call npm install
)

echo [2/2] Abriendo Panel de Control en http://localhost:4000 ...
start "" "http://localhost:4000"
node server.js
pause
