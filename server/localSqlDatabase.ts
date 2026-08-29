import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const DB_FILE_PATH = path.join(process.cwd(), 'trading_bot.sqlite');

export class LocalSqlDatabase {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private isInitialized = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    try {
      this.SQL = await initSqlJs({
        // Locate wasm binary inside node_modules if needed
        locateFile: (file: string) => {
          const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
          if (fs.existsSync(wasmPath)) {
            return wasmPath;
          }
          return file;
        }
      });

      if (fs.existsSync(DB_FILE_PATH)) {
        try {
          const fileBuffer = fs.readFileSync(DB_FILE_PATH);
          this.db = new this.SQL.Database(fileBuffer);
          console.log(`📦 [VPS SQLite] Mevcut veritabanı dosyası yüklendi: ${DB_FILE_PATH}`);
        } catch (readErr) {
          console.warn('⚠️ Mevcut SQLite dosyası okunamadı, yeni oluşturuluyor:', readErr);
          this.db = new this.SQL.Database();
        }
      } else {
        this.db = new this.SQL.Database();
        console.log(`✨ [VPS SQLite] Yeni sıfır maliyetli yerel SQLite veritabanı oluşturuldu: ${DB_FILE_PATH}`);
      }

      this.createTablesIfNotExist();
      this.saveToDiskSync();
      this.isInitialized = true;
    } catch (err) {
      console.error('❌ [VPS SQLite] Veritabanı başlatılamadı:', err);
      throw err;
    }
  }

  private createTablesIfNotExist(): void {
    if (!this.db) return;

    const schemaQueries = `
      -- Kapalı İşlemler Tablosu
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entryPrice REAL NOT NULL,
        exitPrice REAL NOT NULL,
        quantity REAL NOT NULL,
        leverage INTEGER NOT NULL DEFAULT 1,
        pnl REAL NOT NULL,
        pnlPercent REAL NOT NULL,
        exitReason TEXT,
        entryTime INTEGER NOT NULL,
        exitTime INTEGER NOT NULL,
        strategy TEXT,
        fee REAL DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      -- Açık Pozisyonlar Tablosu
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entryPrice REAL NOT NULL,
        currentPrice REAL NOT NULL,
        quantity REAL NOT NULL,
        leverage INTEGER NOT NULL DEFAULT 1,
        liquidationPrice REAL,
        stopLoss REAL,
        takeProfit REAL,
        pnl REAL NOT NULL DEFAULT 0,
        pnlPercent REAL NOT NULL DEFAULT 0,
        entryTime INTEGER NOT NULL,
        strategy TEXT,
        updatedAt INTEGER NOT NULL
      );

      -- Kantitatif Stratejiler ve Botlar Tablosu
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        family TEXT,
        direction TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        parameters TEXT,
        hypothesis TEXT,
        mathematicalFormula TEXT,
        economicRationale TEXT,
        tags TEXT,
        updatedAt INTEGER NOT NULL
      );

      -- Risk Yönetimi ve Bot Durumu Tablosu
      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      -- Sistem Olay ve İşlem Logları Tablosu
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT
      );

      -- İndeksler (Hızlı Sorgular İçin)
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_exitTime ON trades(exitTime);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
    `;

    this.db.run(schemaQueries);
  }

  // Save in-memory SQLite binary to VPS disk
  saveToDiskSync(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE_PATH, buffer);
    } catch (err) {
      console.error('❌ [VPS SQLite] Diske kaydetme hatası:', err);
    }
  }

  queueSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToDiskSync();
    }, 1000);
  }

  // --- TRADES REPOSITORY ---
  insertOrUpdateTrade(trade: any): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO trades 
        (id, symbol, side, entryPrice, exitPrice, quantity, leverage, pnl, pnlPercent, exitReason, entryTime, exitTime, strategy, fee, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        trade.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        trade.symbol || 'BTCUSDT',
        trade.side || 'LONG',
        Number(trade.entryPrice || 0),
        Number(trade.exitPrice || 0),
        Number(trade.quantity || 0),
        Number(trade.leverage || 1),
        Number(trade.pnl || 0),
        Number(trade.pnlPercent || 0),
        trade.exitReason || 'TAKE_PROFIT',
        Number(trade.entryTime || Date.now()),
        Number(trade.exitTime || Date.now()),
        trade.strategy || 'Quant Strategy',
        Number(trade.fee || 0),
        Date.now()
      ]);
      stmt.free();
      this.queueSave();
    } catch (err) {
      console.error('SQLite insertTrade error:', err);
    }
  }

  getAllTrades(limit: number = 200): any[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(`SELECT * FROM trades ORDER BY exitTime DESC LIMIT ${Math.min(limit, 1000)}`);
      if (!res.length || !res[0].values) return [];
      const columns = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    } catch (err) {
      console.error('SQLite getAllTrades error:', err);
      return [];
    }
  }

  // --- POSITIONS REPOSITORY ---
  syncPositions(positions: any[]): void {
    if (!this.db) return;
    try {
      this.db.run(`DELETE FROM positions`);
      if (Array.isArray(positions) && positions.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO positions 
          (id, symbol, side, entryPrice, currentPrice, quantity, leverage, liquidationPrice, stopLoss, takeProfit, pnl, pnlPercent, entryTime, strategy, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of positions) {
          stmt.run([
            p.id,
            p.symbol,
            p.side,
            p.entryPrice,
            p.currentPrice,
            p.quantity,
            p.leverage,
            p.liquidationPrice || null,
            p.stopLoss || null,
            p.takeProfit || null,
            p.pnl || 0,
            p.pnlPercent || 0,
            p.entryTime || Date.now(),
            p.strategy || '',
            Date.now()
          ]);
        }
        stmt.free();
      }
      this.queueSave();
    } catch (err) {
      console.error('SQLite syncPositions error:', err);
    }
  }

  getAllPositions(): any[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(`SELECT * FROM positions ORDER BY entryTime DESC`);
      if (!res.length || !res[0].values) return [];
      const columns = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    } catch (err) {
      console.error('SQLite getAllPositions error:', err);
      return [];
    }
  }

  // --- STRATEGIES REPOSITORY ---
  syncStrategies(strategies: any[]): void {
    if (!this.db) return;
    try {
      if (Array.isArray(strategies) && strategies.length > 0) {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO strategies 
          (id, name, type, family, direction, enabled, symbol, timeframe, parameters, hypothesis, mathematicalFormula, economicRationale, tags, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of strategies) {
          stmt.run([
            s.id,
            s.name,
            s.type,
            s.family || '',
            s.direction || 'BOTH',
            s.enabled ? 1 : 0,
            s.symbol || 'BTCUSDT',
            s.timeframe || '1h',
            JSON.stringify(s.parameters || {}),
            s.hypothesis || '',
            s.mathematicalFormula || '',
            s.economicRationale || '',
            JSON.stringify(s.tags || []),
            Date.now()
          ]);
        }
        stmt.free();
        this.queueSave();
      }
    } catch (err) {
      console.error('SQLite syncStrategies error:', err);
    }
  }

  getAllStrategies(): any[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(`SELECT * FROM strategies`);
      if (!res.length || !res[0].values) return [];
      const columns = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        if (typeof obj.parameters === 'string') {
          try { obj.parameters = JSON.parse(obj.parameters); } catch {}
        }
        if (typeof obj.tags === 'string') {
          try { obj.tags = JSON.parse(obj.tags); } catch {}
        }
        obj.enabled = Boolean(obj.enabled);
        return obj;
      });
    } catch (err) {
      console.error('SQLite getAllStrategies error:', err);
      return [];
    }
  }

  // --- BOT STATE KEY-VALUE REPOSITORY ---
  setBotState(key: string, value: any): void {
    if (!this.db) return;
    try {
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO bot_state (key, value, updatedAt)
        VALUES (?, ?, ?)
      `);
      stmt.run([key, strVal, Date.now()]);
      stmt.free();
      this.queueSave();
    } catch (err) {
      console.error('SQLite setBotState error:', err);
    }
  }

  getBotState(key: string): any {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`SELECT value FROM bot_state WHERE key = ?`);
      const row = stmt.getAsObject([key]);
      stmt.free();
      if (row && row.value) {
        try {
          return JSON.parse(row.value as string);
        } catch {
          return row.value;
        }
      }
      return null;
    } catch (err) {
      console.error('SQLite getBotState error:', err);
      return null;
    }
  }

  // --- LOGS REPOSITORY ---
  insertLog(level: string, message: string, metadata?: any): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO system_logs (id, timestamp, level, message, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run([
        `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        Date.now(),
        level,
        message,
        metadata ? JSON.stringify(metadata) : null
      ]);
      stmt.free();
      this.queueSave();
    } catch (err) {
      console.error('SQLite insertLog error:', err);
    }
  }

  getRecentLogs(limit: number = 100): any[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(`SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ${limit}`);
      if (!res.length || !res[0].values) return [];
      const columns = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    } catch (err) {
      return [];
    }
  }

  // --- DATABASE METRICS & HEALTH ---
  getDatabaseStats(): {
    isOnline: boolean;
    dbFilePath: string;
    fileSizeBytes: number;
    tradesCount: number;
    positionsCount: number;
    strategiesCount: number;
    logsCount: number;
    tables: string[];
  } {
    let fileSize = 0;
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        fileSize = fs.statSync(DB_FILE_PATH).size;
      }
    } catch {}

    if (!this.db) {
      return {
        isOnline: false,
        dbFilePath: DB_FILE_PATH,
        fileSizeBytes: fileSize,
        tradesCount: 0,
        positionsCount: 0,
        strategiesCount: 0,
        logsCount: 0,
        tables: []
      };
    }

    try {
      const tradesRes = this.db.exec(`SELECT COUNT(*) as count FROM trades`);
      const tradesCount = (tradesRes[0]?.values[0]?.[0] as number) || 0;

      const posRes = this.db.exec(`SELECT COUNT(*) as count FROM positions`);
      const positionsCount = (posRes[0]?.values[0]?.[0] as number) || 0;

      const stratRes = this.db.exec(`SELECT COUNT(*) as count FROM strategies`);
      const strategiesCount = (stratRes[0]?.values[0]?.[0] as number) || 0;

      const logRes = this.db.exec(`SELECT COUNT(*) as count FROM system_logs`);
      const logsCount = (logRes[0]?.values[0]?.[0] as number) || 0;

      return {
        isOnline: true,
        dbFilePath: DB_FILE_PATH,
        fileSizeBytes: fileSize,
        tradesCount,
        positionsCount,
        strategiesCount,
        logsCount,
        tables: ['trades', 'positions', 'strategies', 'bot_state', 'system_logs']
      };
    } catch (err) {
      return {
        isOnline: true,
        dbFilePath: DB_FILE_PATH,
        fileSizeBytes: fileSize,
        tradesCount: 0,
        positionsCount: 0,
        strategiesCount: 0,
        logsCount: 0,
        tables: []
      };
    }
  }
}

export const localSqlDb = new LocalSqlDatabase();
