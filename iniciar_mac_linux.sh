#!/usr/bin/env bash
set -e

echo "================================================================"
echo "  POLUX RETARGETING AGENT - MAC / LINUX LAUNCHER (LEAD -> PAYER)"
echo "  Autores: Diego Cuba & Ronaldo Robles Romero"
echo "================================================================"

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js no está instalado. Instálalo con: brew install node"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/2] Instalando dependencias reales (Baileys WhatsApp, Nodemailer, MSSQL)..."
  npm install
fi

echo "[2/2] Iniciando servidor real en http://localhost:4000 ..."
if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "http://localhost:4000") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 2 && xdg-open "http://localhost:4000") &
fi

node server.js
