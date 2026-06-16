// VENDORED from cirv-guard.php (the canonical WCAG rules), mirrored via the public scanner.
// Keep in sync with the plugin — see docs/adr/0001-vendored-engine.md.
'use strict';

// Safe remote-URL fetch with SSRF protection.
// A public URL may redirect to an internal one, so every hop is re-validated.

const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB cap
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;
const UA =
  'Mozilla/5.0 (compatible; CirvA11yScanner/1.0; +https://cirvgreen.com/guard)';

// Private / reserved IPv4 + IPv6 ranges we must never fetch.
function isBlockedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // unique-local
    if (v.startsWith('fe80')) return true; // link-local
    if (v.startsWith('::ffff:')) return isBlockedIp(v.replace('::ffff:', '')); // mapped v4
    return false;
  }
  return true; // unknown format → block
}

async function assertSafeUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new ScanError('That doesn’t look like a valid URL.', 'bad_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ScanError('Only http and https URLs are supported.', 'bad_scheme');
  }
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new ScanError('Internal hosts cannot be scanned.', 'blocked');
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new ScanError('Couldn’t resolve that domain. Check the spelling.', 'dns');
  }
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) {
    throw new ScanError('That address resolves to a private network and can’t be scanned.', 'blocked');
  }
  return u.toString();
}

class ScanError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'scan_error';
    this.userFacing = true;
  }
}

// Fetch HTML, manually following (and re-validating) redirects.
async function fetchHtml(rawUrl) {
  let current = await assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await axios.get(current, {
      timeout: TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: MAX_BYTES,
      responseType: 'text',
      decompress: true,
      validateStatus: (s) => (s >= 200 && s < 400),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    }).catch((err) => {
      if (err.response && [301, 302, 303, 307, 308].includes(err.response.status)) {
        return err.response;
      }
      const reason = err.code === 'ECONNABORTED' ? 'The site took too long to respond.' : 'Couldn’t reach that site.';
      throw new ScanError(reason, 'fetch');
    });

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = new URL(res.headers.location, current).toString();
      current = await assertSafeUrl(next);
      continue;
    }

    const ctype = String(res.headers['content-type'] || '');
    if (!ctype.includes('html')) {
      throw new ScanError('That URL didn’t return an HTML page.', 'not_html');
    }
    return { html: String(res.data || ''), finalUrl: current };
  }
  throw new ScanError('Too many redirects.', 'redirects');
}

module.exports = { fetchHtml, assertSafeUrl, isBlockedIp, ScanError };
