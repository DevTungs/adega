#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Criando backup..."

# Criar diretorio de backups
mkdir -p data/backups

# Gerar timestamp
timestamp=$(date +%Y%m%d-%H%M%S)

# Copiar banco de dados
if [ -f "data/delivery.db" ]; then
    cp "data/delivery.db" "data/backups/backup-${timestamp}.db"
    echo "Backup criado: data/backups/backup-${timestamp}.db"
else
    echo "ERRO: Banco de dados nao encontrado em data/delivery.db"
    exit 1
fi

# Limpar backups antigos (manter ultimos 30)
count=$(ls -1 data/backups/backup-*.db 2>/dev/null | wc -l)
if [ "$count" -gt 30 ]; then
    echo "Limpando backups antigos..."
    ls -1t data/backups/backup-*.db | tail -n +31 | xargs rm -f
fi

echo "Concluido!"
