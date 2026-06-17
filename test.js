'use strict';

// Crawler tests — focused on scanOne's fetch flow + the Firecrawl fallback.
// (The cookie engine itself is covered by engine/test.js.)

const assert = require('assert');
const { scanOne } = require('./src/crawl');
const { ScanError } = require('./engine/fetch');

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); fail++; }
}

const fakeOk = {
  fetchRobots: async () => ({ allowed: () => true }),
  fetchHtml: async () => ({ html: '<x>', finalUrl: 'https://shop.com/' }),
  scan: () => ({ score: 50, passes: 5, fails: 5, total: 10, results: [{ check: 'CMP', status: 'fail' }] }),
};
const blocked = { ...fakeOk, fetchHtml: async () => { throw new ScanError('Access blocked.', 'blocked_403'); } };

(async () => {
  await t('scanOne ok path returns score', async () => {
    const row = await scanOne('shop.com', { deps: fakeOk, now: 1 });
    assert.strictEqual(row.status, 'ok');
    assert.strictEqual(row.score, 50);
    assert.strictEqual(row.via, 'direct');
  });
  await t('scanOne respects robots disallow', async () => {
    const deps = { ...fakeOk, fetchRobots: async () => ({ allowed: () => false }) };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'skipped');
    assert.strictEqual(row.error_code, 'robots_disallow');
  });
  await t('scanOne recovers a blocked_403 via Firecrawl fallback', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => ({ html: '<x>', finalUrl: 'https://shop.com/' }) };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'ok');
    assert.strictEqual(row.via, 'firecrawl');
  });
  await t('scanOne keeps the original error when Firecrawl also fails', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => { throw new ScanError('fc down', 'firecrawl_network'); } };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'blocked_403');
  });
  await t('scanOne does NOT use Firecrawl for non-recoverable codes (http_404)', async () => {
    let called = false;
    const deps = {
      ...fakeOk,
      fetchHtml: async () => { throw new ScanError('gone', 'http_404'); },
      fetchViaFirecrawl: async () => { called = true; return { html: '<x>', finalUrl: 'x' }; },
    };
    const row = await scanOne('shop.com', { deps, now: 1 });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'http_404');
    assert.strictEqual(called, false);
  });
  await t('scanOne skips Firecrawl when firecrawl:false', async () => {
    const deps = { ...blocked, fetchViaFirecrawl: async () => ({ html: '<x>', finalUrl: 'x' }) };
    const row = await scanOne('shop.com', { deps, now: 1, firecrawl: false });
    assert.strictEqual(row.status, 'error');
    assert.strictEqual(row.error_code, 'blocked_403');
  });

  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})();
