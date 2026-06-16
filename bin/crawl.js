#!/usr/bin/env node
'use strict';

// CLI: crawl a seed list into the SQLite dataset.
//   node bin/crawl.js seeds/eaa-ecommerce.sample.json
//   node bin/crawl.js seeds.txt --db data/index.db --concurrency 4 --no-robots

const fs = require('fs');
const path = require('path');
const { openStore, countScans } = require('../src/store');
const { crawl } = require('../src/crawl');

function argVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

function loadSeeds(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  if (file.endsWith('.json')) {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : j.domains || [];
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

async function main() {
  const args = process.argv.slice(2);
  const seedFile = args[0];
  if (!seedFile || seedFile.startsWith('--')) {
    console.error('usage: crawl <seeds.json|.txt> [--db path] [--concurrency N] [--no-robots]');
    process.exit(1);
  }
  const dbPath = argVal(args, '--db') || path.join(__dirname, '..', 'data', 'index.db');
  const concurrency = parseInt(argVal(args, '--concurrency') || '4', 10);
  const respectRobots = !args.includes('--no-robots');

  const domains = loadSeeds(seedFile);
  console.log(
    `crawling ${domains.length} domains -> ${dbPath} (concurrency ${concurrency}, robots ${respectRobots})`
  );

  const db = openStore(dbPath);
  const t0 = Date.now();
  const rows = await crawl(db, domains, {
    concurrency,
    respectRobots,
    onProgress: ({ done, total, domain, status, score }) =>
      console.log(`[${done}/${total}] ${domain} -> ${status}${score != null ? ' ' + score : ''}`),
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = rows.filter((r) => r.status === 'ok').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;
  const errored = rows.filter((r) => r.status === 'error').length;
  console.log(`\ndone in ${secs}s — ok ${ok}, skipped ${skipped}, error ${errored}`);
  console.log(`total rows in dataset: ${countScans(db)}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
