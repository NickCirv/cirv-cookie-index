'use strict';

// Crawler-grade fetch: retry + backoff, a standard browser User-Agent, and
// granular error codes so the dataset records *why* a site failed. SSRF safety
// is reused from the scanner's assertSafeUrl — we never duplicate the IP logic,
// and we never touch the deployed scanner.
//
// We present as a normal browser on purpose: this index measures the USER-view —
// what a real browser actually receives, including any consent/cookie banners a
// real visitor would see. A bot-view (the server's response to a non-browser
// agent) is not what users get. We still play fair: we respect robots.txt (see
// robots.js), fetch only public homepages, send no cookies/credentials, and
// never execute JS or solve challenges.

const axios = require('axios');
const { assertSafeUrl, ScanError } = require('../engine/fetch');

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;
const RETRIES = 2;

// A current Chrome-on-macOS fingerprint. Real browser headers (sec-ch-ua,
// sec-fetch-*) let well-behaved bot-management serve us the page a user would
// see, without us executing JS or solving challenges.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua': '"Google Chrome";v="126", "Chromium";v="126", "Not/A)Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
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
