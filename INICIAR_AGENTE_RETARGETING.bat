@echo off
title Polux Retargeting AI - Agente LEAD a PAYER (Puerto 4000)
cd /d "%~dp0"

echo ============================================================================
echo   POLUX RETARGETING AI - AGENTE DE RECUPERACION DE ABANDONO (LEAD -> PAYER)
echo   Autores: Diego ^& Ronaldo · Integrado con PoluxImportDB
echo ============================================================================

if not exist "node_modules" (
    echo [1/2] Instalando dependencias gratuitas ^(express, mssql, nodemailer^)...
    call npm install
)

echo [2/2] Iniciando servidor del Agente en http://localhost:4000 ...
start "" "http://localhost:4000"
node server.js
pause
