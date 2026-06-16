#!/usr/bin/env node
'use strict';

// Quick read of the dataset: leaderboard (latest scan per domain) + status
// breakdown. Used for sanity checks and as the data source for monitoring.
//   node bin/report.js [--db data/index.db] [--json]

const path = require('path');
const { openStore, latestScans, countScans } = require('../src/store');

function argVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const args = process.argv.slice(2);
const dbPath = argVal(args, '--db') || path.join(__dirname, '..', 'data', 'index.db');
const db = openStore(dbPath);
const rows = latestScans(db);

if (args.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
  db.close();
  return;
}

const ok = rows.filter((r) => r.status === 'ok');
const errored = rows.filter((r) => r.status === 'error');
const skipped = rows.filter((r) => r.status === 'skipped');

console.log(`dataset: ${countScans(db)} total scans, ${rows.length} domains\n`);
console.log('=== leaderboard (best first) ===');
for (const r of rows) {
  const score = r.status === 'ok' ? String(r.score).padStart(3) : ' --';
  const note = r.status === 'ok' ? `${r.fails} fails` : `${r.status}: ${r.error_code}`;
  console.log(`${score}  ${r.domain.padEnd(20)} ${note}`);
}
console.log(`\nok ${ok.length} · skipped ${skipped.length} · error ${errored.length}`);

if (errored.length) {
  const byCode = {};
  for (const r of errored) byCode[r.error_code] = (byCode[r.error_code] || 0) + 1;
  console.log('error breakdown: ' + JSON.stringify(byCode));
}
db.close();
