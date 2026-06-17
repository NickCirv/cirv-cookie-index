'use strict';

// API keys are stored HASHED (sha256) — the raw key is shown to the customer
// exactly once, like a password. We look up by hash, never store the secret.
const crypto = require('crypto');

function ensureKeysTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash    TEXT UNIQUE NOT NULL,
      email       TEXT,
      customer_id TEXT,
      tier        TEXT NOT NULL DEFAULT 'free',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_keys_email    ON api_keys(email);
    CREATE INDEX IF NOT EXISTS idx_keys_customer ON api_keys(customer_id);
  `);
}

function generateKey() {
  return 'cirv_' + crypto.randomBytes(24).toString('hex');
}

function hashKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function findByHash(db, hash) {
  return db.prepare("SELECT * FROM api_keys WHERE key_hash = ? AND status = 'active'").get(hash);
}

function findByEmail(db, email) {
  return db.prepare('SELECT * FROM api_keys WHERE email = ?').get(email);
}

// Returns the RAW key (caller must deliver it once; never recoverable after).
function issueKey(db, { email, customerId, tier = 'free' }, now) {
  const raw = generateKey();
  db.prepare(
    `INSERT INTO api_keys (key_hash, email, customer_id, tier, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`
  ).run(hashKey(raw), email || null, customerId || null, tier, now, now);
  return raw;
}

function setTierByEmail(db, email, { customerId, tier }, now) {
  return db
    .prepare(`UPDATE api_keys SET tier = ?, customer_id = ?, status = 'active', updated_at = ? WHERE email = ?`)
    .run(tier, customerId || null, now, email).changes;
}

function setTierByCustomer(db, customerId, tier, now) {
  return db
    .prepare(`UPDATE api_keys SET tier = ?, status = 'active', updated_at = ? WHERE customer_id = ?`)
    .run(tier, now, customerId).changes;
}

// On cancellation we downgrade to free rather than hard-disable — keeps the funnel.
function revokeByCustomer(db, customerId, now) {
  return db
    .prepare(`UPDATE api_keys SET tier = 'free', updated_at = ? WHERE customer_id = ?`)
    .run(now, customerId).changes;
}

// Provision on payment: upgrade an existing (free) key for that email, else mint one.
function upgradeOrIssue(db, { email, customerId, tier }, now) {
  if (email && findByEmail(db, email)) {
    setTierByEmail(db, email, { customerId, tier }, now);
    return null; // customer already has their key
  }
  return issueKey(db, { email, customerId, tier }, now);
}

module.exports = {
  ensureKeysTable, generateKey, hashKey, findByHash, findByEmail,
  issueKey, setTierByEmail, setTierByCustomer, revokeByCustomer, upgradeOrIssue,
};
