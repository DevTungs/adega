#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
    echo "Node.js nao encontrado! Rode ./setup.sh primeiro."
    exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Instalando dependencias do frontend..."
    cd frontend
    npm install
    cd ..
fi

node start.js
