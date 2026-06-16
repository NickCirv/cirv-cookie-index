'use strict';

// Crawler-grade fetch: retry + backoff, browser-like (but HONEST) headers, and
// granular error codes so the dataset records *why* a site failed. SSRF safety
// is reused from the scanner's assertSafeUrl — we never duplicate the IP logic,
// and we never touch the deployed scanner.
//
// We identify as a legitimate bot (the Googlebot/bingbot convention), respect
// robots.txt (see robots.js), and only fetch public homepages. We do NOT spoof
// a full browser to defeat bot-management — that would betray the index's
// transparency and cross into evasion.

const axios = require('axios');
const { assertSafeUrl, ScanError } = require('../engine/fetch');

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 4;
const RETRIES = 2;

const UA = 'Mozilla/5.0 (compatible; CirvA11yIndex/1.0; +https://cirvgreen.com/guard)';
const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,fr;q=0.7,nl;q=0.6',
  'Accept-Encoding': 'gzip, deflate, br',
};

const RETRYABLE = new Set(['timeout', 'server_5xx', 'rate_limited', 'network']);
const NET_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(rawUrl, client, safe) {
  let current = await safe(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await client.get(current, {
        timeout: TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: MAX_BYTES,
        responseType: 'text',
        decompress: true,
        validateStatus: (s) => s >= 200 && s < 600, // statuses handled manually
        headers: HEADERS,
      });
    } catch (err) {
      if (err && err.code === 'ECONNABORTED') throw new ScanError('The site took too long.', 'timeout');
      if (err && NET_CODES.has(err.code)) throw new ScanError('Network error.', 'network');
      throw new ScanError('Couldn’t reach that site.', 'fetch');
    }

    const s = res.status;
    if (s >= 300 && s < 400 && res.headers && res.headers.location) {
      const next = new URL(res.headers.location, current).toString();
      current = await safe(next);
      continue;
    }
    if (s === 401 || s === 403) throw new ScanError('Access blocked.', 'blocked_' + s);
    if (s === 429) throw new ScanError('Rate limited.', 'rate_limited');
    if (s >= 500) throw new ScanError('Server error.', 'server_5xx');
    if (s >= 400) throw new ScanError('HTTP ' + s, 'http_' + s);

    const ctype = String((res.headers && res.headers['content-type']) || '');
    if (!ctype.includes('html')) throw new ScanError('Not an HTML page.', 'not_html');
    return { html: String(res.data || ''), finalUrl: current, status: s };
  }
  throw new ScanError('Too many redirects.', 'redirects');
}

// Public: fetch with retry on transient failures only.
async function fetchHtml(rawUrl, opts = {}) {
  const client = opts.client || axios;
  const safe = opts.assertSafeUrl || assertSafeUrl;
  const retries = opts.retries ?? RETRIES;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchOnce(rawUrl, client, safe);
    } catch (err) {
      lastErr = err;
      const transient = err instanceof ScanError && RETRYABLE.has(err.code);
      if (!transient || attempt === retries) break;
      await sleep(opts.backoffMs != null ? opts.backoffMs : 500 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

module.exports = { fetchHtml, UA };
