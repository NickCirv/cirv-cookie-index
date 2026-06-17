'use strict';

// Fallback fetch through Firecrawl's managed browser (real Chrome, server-side).
// Used ONLY when a direct fetch is blocked by bot-management (blocked_403 etc.),
// because those blocks are TLS/JA3-level — a real browser is the only way past.
// Firecrawl renders JS, which matters doubly for the cookie index: it surfaces
// JS-injected consent banners + trackers a static fetch can't see, lifting the
// signal above the "conservative floor". Public homepages only; no auth/cookies.
//
// Activates automatically when FIRECRAWL_API_KEY is set (local/n8n refresh). The
// Render build leaves it unset, so deploys stay light + free.

const axios = require('axios');
const { ScanError } = require('../engine/fetch');

const ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';
const REQUEST_TIMEOUT_MS = 45000; // generous: Firecrawl renders JS server-side
const PAGE_TIMEOUT_MS = 25000;

async function fetchViaFirecrawl(url, opts = {}) {
  const apiKey = opts.apiKey || process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new ScanError('Firecrawl not configured.', 'firecrawl_unconfigured');
  const client = opts.client || axios;

  let res;
  try {
    res = await client.post(
      ENDPOINT,
      { url, formats: ['rawHtml'], onlyMainContent: false, timeout: opts.pageTimeoutMs || PAGE_TIMEOUT_MS },
      {
        timeout: opts.timeout || REQUEST_TIMEOUT_MS,
        headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
        validateStatus: (s) => s >= 200 && s < 600,
      }
    );
  } catch (err) {
    throw new ScanError('Firecrawl request failed.', 'firecrawl_network');
  }

  if (res.status === 402) throw new ScanError('Firecrawl out of credits.', 'firecrawl_credits');
  if (res.status === 429) throw new ScanError('Firecrawl rate limited.', 'firecrawl_rate');
  if (res.status >= 400) throw new ScanError('Firecrawl HTTP ' + res.status, 'firecrawl_http_' + res.status);

  const data = (res.data && res.data.data) || {};
  const html = data.rawHtml || data.html || '';
  if (!html) throw new ScanError('Firecrawl returned no HTML.', 'firecrawl_empty');
  const finalUrl = (data.metadata && data.metadata.sourceURL) || url;
  return { html: String(html), finalUrl, status: 200 };
}

module.exports = { fetchViaFirecrawl };
