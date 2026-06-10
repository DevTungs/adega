#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "          ADEGA DELIVERY SYSTEM - SETUP"
echo "============================================================"
echo ""

# [1/6] Verificando Node.js
echo "[1/6] Verificando Node.js..."
if ! command -v node &>/dev/null; then
    echo ""
    echo "  Node.js nao encontrado!"
    echo "  Instale manualmente: https://nodejs.org"
    echo "  Ou use o gerenciador de pacotes da sua distro:"
    echo "    Ubuntu/Debian: sudo apt install nodejs npm"
    echo "    Fedora:        sudo dnf install nodejs npm"
    echo "    Arch:          sudo pacman -S nodejs npm"
    echo ""
    exit 1
fi
NODE_VER=$(node --version)
echo "  Node.js $NODE_VER encontrado"

# [2/6] Instalando dependencias do backend
echo ""
echo "[2/6] Instalando dependencias do backend..."
cd backend
npm install
cd ..

# [3/6] Compilando backend
echo ""
echo "[3/6] Compilando backend..."
cd backend
npm run build
cd ..

# [4/6] Executando migracoes do banco
echo ""
echo "[4/6] Executando migracoes do banco..."
cd backend
npm run migrate
cd ..

# [5/6] Populando banco com dados iniciais
echo ""
echo "[5/6] Populando banco com dados iniciais..."
cd backend
npm run seed
cd ..

# [6/6] Instalando dependencias do frontend
echo ""
echo "[6/6] Instalando dependencias do frontend..."
cd frontend
npm install
cd ..

echo ""
echo "============================================================"
echo ""
echo "  Setup concluido com sucesso!"
echo ""
echo "  Para iniciar o sistema:"
echo "    ./start.sh"
echo ""
echo "  Credenciais padrao:"
echo "  - Usuario: admin"
echo "  - Senha:   admin123"
echo ""
echo "============================================================"
