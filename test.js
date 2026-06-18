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

  // ---- programmatic SEO pages ----
  const seo = require('./src/seo-pages');
  const fakeH = {
    layout: (o) => `T:${o.title}\nC:${o.canonical}\n${o.body}`,
    esc: (x) => String(x == null ? '' : x),
    grade: (s) => (s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 40 ? 'C' : 'F'),
    gradeClass: () => 'g-x',
    safeFile: (d) => String(d).replace(/[^a-z0-9.-]/gi, '_'),
    fmtDate: () => '2026-01-01',
  };
  await t('countryOf maps TLDs (and .co.uk, fallback)', () => {
    assert.strictEqual(seo.countryOf('notino.de'), 'Germany');
    assert.strictEqual(seo.countryOf('shop.co.uk'), 'United Kingdom');
    assert.strictEqual(seo.countryOf('zalando.com'), 'International');
  });
  await t('groupByCountry drops <2-store countries and sorts by count', () => {
    const rows = [
      { domain: 'a.de', score: 90 }, { domain: 'b.de', score: 50 }, { domain: 'c.de', score: 30 },
      { domain: 'd.fr', score: 80 }, { domain: 'e.fr', score: 70 },
      { domain: 'solo.it', score: 60 },
    ];
    const g = seo.groupByCountry(rows);
    assert.deepStrictEqual(g.map((x) => x.country), ['Germany', 'France']);
    assert.strictEqual(g[0].rows[0].score, 90);
  });
  await t('renderCountryHub hides D/F in soft mode, reveals in named', () => {
    const group = { country: 'Germany', slug: 'germany', rows: [{ domain: 'good.de', score: 92 }, { domain: 'bad.de', score: 20 }], avg: 56, total: 2 };
    const soft = seo.renderCountryHub(group, { base: 'https://x', mode: 'soft', h: fakeH });
    assert.ok(soft.includes('/sites/good.de.html') && !soft.includes('/sites/bad.de.html'));
    const named = seo.renderCountryHub(group, { base: 'https://x', mode: 'named', h: fakeH });
    assert.ok(named.includes('/sites/bad.de.html'));
  });
  await t('renderBestList includes only A/B', () => {
    const out = seo.renderBestList([{ domain: 'top.de', score: 95 }, { domain: 'mid.fr', score: 50 }], { base: 'https://x', mode: 'soft', h: fakeH });
    assert.ok(out.includes('/sites/top.de.html') && !out.includes('mid.fr'));
  });

  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})();
