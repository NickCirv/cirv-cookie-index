'use strict';

// SQLite dataset. Append-only `scans` table: one row per domain per crawl run,
// so we get both the latest score AND history (the "improving / declining"
// angle the directory needs) from a single table.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function openStore(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      domain       TEXT    NOT NULL,
      final_url    TEXT,
      status       TEXT    NOT NULL,
      score        INTEGER,
      passes       INTEGER,
      fails        INTEGER,
      total        INTEGER,
      results_json TEXT,
      error_code   TEXT,
      scanned_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scans_domain     ON scans(domain);
    CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at);
  `);
  return db;
}

function recordScan(db, row) {
  return db
    .prepare(
      `INSERT INTO scans
        (domain, final_url, status, score, passes, fails, total, results_json, error_code, scanned_at)
       VALUES
        (@domain, @final_url, @status, @score, @passes, @fails, @total, @results_json, @error_code, @scanned_at)`
    )
    .run({
      domain: row.domain,
      final_url: row.final_url || null,
      status: row.status,
      score: row.score ?? null,
      passes: row.passes ?? null,
      fails: row.fails ?? null,
      total: row.total ?? null,
      results_json: row.results ? JSON.stringify(row.results) : null,
      error_code: row.error_code || null,
      scanned_at: row.scanned_at || Date.now(),
    });
}

// Latest scan per domain, best score first — the directory's default ordering.
function latestScans(db) {
  return db
    .prepare(
      `SELECT s.* FROM scans s
       JOIN (SELECT domain, MAX(scanned_at) AS m FROM scans GROUP BY domain) t
         ON s.domain = t.domain AND s.scanned_at = t.m
       ORDER BY (s.score IS NULL), s.score DESC, s.domain ASC`
    )
    .all();
}

function countScans(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM scans').get().n;
}

module.exports = { openStore, recordScan, latestScans, countScans };
