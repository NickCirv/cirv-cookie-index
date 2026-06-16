#!/usr/bin/env node
'use strict';

// Generate the static directory site from the dataset.
//   node bin/build-site.js [--db data/index.db] [--out ../directory/public] [--base https://index.cirvgreen.com]

const path = require('path');
const { openStore } = require('../src/store');
const { buildSite } = require('../src/site');

function argVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const args = process.argv.slice(2);
const dbPath = argVal(args, '--db') || path.join(__dirname, '..', 'data', 'index.db');
const outDir = argVal(args, '--out') || path.join(__dirname, '..', 'public');
const base = argVal(args, '--base');
const apiUrl = argVal(args, '--api-url');
const mode = argVal(args, '--mode');
const aProvider = argVal(args, '--analytics-provider') || process.env.ANALYTICS_PROVIDER;
const aId = argVal(args, '--analytics-id') || process.env.ANALYTICS_ID;
const opts = {};
if (base) opts.base = base;
if (apiUrl) opts.apiUrl = apiUrl;
if (mode) opts.mode = mode;
if (aProvider && aId) opts.analytics = { provider: aProvider, id: aId };

const db = openStore(dbPath);
const res = buildSite(db, outDir, opts);
db.close();
console.log(`built ${res.pages} pages (${res.scored} scored / ${res.total} domains) -> ${outDir}`);
