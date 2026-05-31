import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from './app.config';

// Resolve DB path - support absolute paths (Electron) or relative paths (dev)
function resolveDbPath(): string {
  const dbPathEnv = config.dbPath;

  // If absolute path, use it directly
  if (path.isAbsolute(dbPathEnv)) {
    return dbPathEnv;
  }

  // If running in Electron (packaged), use userData
  if (config.electronUserData) {
    return path.join(config.electronUserData, 'data', 'delivery.db');
  }

  // Development: resolve relative to project root
  return path.resolve(__dirname, '../../..', dbPathEnv);
}

const dbPath = resolveDbPath();

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlDb: SqlJsDatabase | null = null;

export async function initDatabase(): Promise<DatabaseWrapper> {
  if (sqlDb) return new DatabaseWrapper(sqlDb);

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run('PRAGMA journal_mode=WAL');
  sqlDb.run('PRAGMA foreign_keys=ON');
  sqlDb.run('PRAGMA busy_timeout=5000');

  const wrapper = new DatabaseWrapper(sqlDb);

  // Auto-save every 5 seconds
  const saveInterval = setInterval(() => wrapper.save(), 5000);
  (wrapper as any)._saveInterval = saveInterval;

  // Save on exit (skip signal handlers in Electron — main process handles lifecycle)
  if (!process.versions.electron) {
    const saveAndExit = () => { wrapper.save(); process.exit(0); };
    process.on('SIGINT', saveAndExit);
    process.on('SIGTERM', saveAndExit);
  }
  process.on('exit', () => wrapper.save());

  return wrapper;
}

export class DatabaseWrapper {
  private db: SqlJsDatabase;
  private autoIncrementCounters: Map<string, number> = new Map();

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /** Execute SQL and return rows as objects */
  raw(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) stmt.bind(params);

      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch {
      // For INSERT/UPDATE/DELETE/DDL
      this.db.run(sql, params);
      return [];
    }
  }

  /** Execute SQL (INSERT/UPDATE/DELETE/DDL) */
  run(sql: string, params: any[] = []): void {
    this.db.run(sql, params);
  }

  /** Get a single row */
  get(sql: string, params: any[] = []): any | undefined {
    const rows = this.raw(sql, params);
    return rows[0];
  }

  /** Get all rows */
  all(sql: string, params: any[] = []): any[] {
    return this.raw(sql, params);
  }

  /** Insert and return the row */
  insert(table: string, data: Record<string, any>): any {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);

    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    this.run(sql, values);
    return data;
  }

  /** Update rows */
  update(table: string, data: Record<string, any>, where: string, whereParams: any[] = []): void {
    const keys = Object.keys(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => data[k]), ...whereParams];

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    this.run(sql, values);
  }

  /** Delete rows */
  delete(table: string, where: string, params: any[] = []): void {
    this.run(`DELETE FROM ${table} WHERE ${where}`, params);
  }

  /** Get next auto-increment number */
  nextOrderNumber(): number {
    const row = this.get('SELECT last_number FROM order_sequence');
    const next = (row?.last_number || 0) + 1;
    this.run('UPDATE order_sequence SET last_number = ?', [next]);
    return next;
  }

  /** Save database to disk */
  save(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch {
      // Silent fail on save - will retry on next interval
    }
  }

  /** Run migrations */
  async migrate(): Promise<void> {
    const migrationDir = path.resolve(__dirname, '../database/migrations');
    if (!fs.existsSync(migrationDir)) return;

    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const file of files) {
      try {
        const migration = require(path.join(migrationDir, file));
        if (migration.up) {
          await migration.up(this);
        }
      } catch {
        // Migration already applied or failed silently
      }
    }
  }

  /** Run seeds */
  async seed(): Promise<void> {
    const seedDir = path.resolve(__dirname, '../database/seeds');
    if (!fs.existsSync(seedDir)) return;

    const files = fs.readdirSync(seedDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const file of files) {
      try {
        const seed = require(path.join(seedDir, file));
        if (seed.seed) {
          await seed.seed(this);
        }
      } catch {
        // Seed already applied or failed silently
      }
    }
  }

  /** Check health */
  async healthCheck(): Promise<boolean> {
    try {
      this.raw('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Close database */
  close(): void {
    if ((this as any)._saveInterval) {
      clearInterval((this as any)._saveInterval);
    }
    this.save();
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseWrapper | null = null;

export function getDb(): DatabaseWrapper {
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase() first.');
  return dbInstance;
}

export function setDb(db: DatabaseWrapper): void {
  dbInstance = db;
}

// Knex-like query builder helpers for common operations
export const qb = {
  select: (table: string, columns: string = '*', where?: string, params: any[] = []) => {
    const sql = `SELECT ${columns} FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    return getDb().all(sql, params);
  },

  selectOne: (table: string, columns: string = '*', where?: string, params: any[] = []) => {
    const sql = `SELECT ${columns} FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1`;
    return getDb().get(sql, params);
  },

  insert: (table: string, data: Record<string, any>) => {
    return getDb().insert(table, data);
  },

  update: (table: string, data: Record<string, any>, where: string, params: any[] = []) => {
    return getDb().update(table, data, where, params);
  },

  delete: (table: string, where: string, params: any[] = []) => {
    return getDb().delete(table, where, params);
  },

  count: (table: string, where?: string, params: any[] = []): number => {
    const sql = `SELECT COUNT(*) as count FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const row = getDb().get(sql, params);
    return row?.count || 0;
  },

  sum: (table: string, column: string, where?: string, params: any[] = []): number => {
    const sql = `SELECT SUM(${column}) as total FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const row = getDb().get(sql, params);
    return row?.total || 0;
  },

  avg: (table: string, column: string, where?: string, params: any[] = []): number => {
    const sql = `SELECT AVG(${column}) as avg FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const row = getDb().get(sql, params);
    return row?.avg || 0;
  },
};

export default { initDatabase, getDb, setDb, qb, DatabaseWrapper };
