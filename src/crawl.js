'use strict';

// Crawl orchestrator: seed domains -> (robots check) -> fetch homepage ->
// scan with the Cirv engine -> store one row per domain.
//
// Dependencies are injectable (opts.deps) so the orchestrator is unit-testable
// without network access — and without the SSRF guard blocking a localhost
// fixture server.

const { scan } = require('../engine/cookies');
const { ScanError } = require('../engine/fetch');
const { fetchHtml } = require('./fetch'); // crawler-grade: retry + granular errors
const { fetchRobots } = require('./robots');
const { pLimit } = require('./limit');
const { recordScan } = require('./store');

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "https://www.Foo.com/bar" -> "foo.com"
function normalizeDomain(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

function homepageUrl(domain) {
  return 'https://' + domain + '/';
}

async function scanOne(domain, opts = {}) {
  const { respectRobots = true, deps = {} } = opts;
  const _fetchHtml = deps.fetchHtml || fetchHtml;
  const _scan = deps.scan || scan;
  const _fetchRobots = deps.fetchRobots || fetchRobots;
  const scanned_at = opts.now || Date.now();

  try {
    if (respectRobots) {
      const robots = await _fetchRobots('https://' + domain);
      if (!robots.allowed('/')) {
        return { domain, status: 'skipped', error_code: 'robots_disallow', scanned_at };
      }
    }
    const { html, finalUrl } = await _fetchHtml(homepageUrl(domain));
    const r = _scan(html);
    return {
      domain,
      final_url: finalUrl,
      status: 'ok',
      score: r.score,
      passes: r.passes,
      fails: r.fails,
      total: r.total,
      results: r.results,
      scanned_at,
    };
  } catch (err) {
    const error_code = err instanceof ScanError ? err.code : (err && err.code) || 'error';
    return { domain, status: 'error', error_code, scanned_at };
  }
}

async function crawl(db, domains, opts = {}) {
  const concurrency = opts.concurrency || DEFAULT_CONCURRENCY;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const respectRobots = opts.respectRobots !== false;
  const onProgress = opts.onProgress || (() => {});
  const deps = opts.deps || {};

  const seen = new Set();
  const list = [];
  for (const d of domains) {
    const n = normalizeDomain(d);
    if (n && !seen.has(n)) {
      seen.add(n);
      list.push(n);
    }
  }

  const limit = pLimit(concurrency);
  let done = 0;
  const tasks = list.map((domain) =>
    limit(async () => {
      const row = await scanOne(domain, { respectRobots, deps });
      recordScan(db, row);
      if (delayMs) await sleep(delayMs);
      done++;
      onProgress({ done, total: list.length, domain, status: row.status, score: row.score });
      return row;
    })
  );
  return Promise.all(tasks);
}

module.exports = { crawl, scanOne, normalizeDomain, homepageUrl };
