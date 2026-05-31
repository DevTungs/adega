#!/bin/sh
set -e

echo "[Entrypoint] Waiting for MySQL..."
until node -e "
  const mysql = require('mysql2/promise');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    await conn.ping();
    await conn.end();
    console.log('MySQL ready');
  })().catch(e => { process.exit(1); });
" 2>/dev/null; do
  echo "[Entrypoint] MySQL not ready, retrying in 3s..."
  sleep 3
done

echo "[Entrypoint] Running migrations..."
node dist/database/migrate.js

echo "[Entrypoint] Running seed..."
node dist/database/seed.js

echo "[Entrypoint] Starting server..."
exec "$@"
