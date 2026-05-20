import { initDatabase } from '../config/database';

async function main() {
  console.log('[Migrate] Inicializando banco de dados...');
  const db = await initDatabase();

  console.log('[Migrate] Executando migracoes...');
  await db.migrate();

  console.log('[Migrate] Migracoes concluidas!');
  db.close();
}

main().catch((err) => {
  console.error('[Migrate] Erro:', err);
  process.exit(1);
});
