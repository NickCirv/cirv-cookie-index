'use strict';

// Read access to the scan dataset for the API. Reuses the crawler's store; adds
// a single-domain lookup. The paid API serves the FULL, named dataset.
const { openStore, latestScans } = require('../src/store');

function getSiteLatest(db, domain) {
  return db.prepare('SELECT * FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1').get(domain);
}

function normalizeDomain(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

module.exports = { openStore, latestScans, getSiteLatest, normalizeDomain };
