import { initDatabase } from '../config/database';

async function main() {
  console.log('[Seed] Inicializando banco de dados...');
  const db = await initDatabase();

  console.log('[Seed] Executando seeds...');
  await db.seed();

  console.log('[Seed] Seeds concluidos!');
  db.close();
}

main().catch((err) => {
  console.error('[Seed] Erro:', err);
  process.exit(1);
});
