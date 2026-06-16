'use strict';

// robots.txt awareness. We are a polite, identifiable crawler — we honour
// Disallow rules for our UA group (falling back to '*'). SSRF safety is
// reused from the scanner's assertSafeUrl so we never duplicate the IP logic.

const axios = require('axios');
const { assertSafeUrl } = require('../engine/fetch');

const UA_TOKEN = 'cirva11yscanner'; // lowercase token matched against robots UA groups
const TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;

// Turn a Disallow/Allow path pattern into a prefix regex.
// Supports '*' wildcard and trailing '$' end-anchor (the de-facto standard).
function matchRule(rulePath, urlPath) {
  let pat = rulePath.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  if (pat.endsWith('\\$')) pat = pat.slice(0, -2) + '$';
  return new RegExp('^' + pat).test(urlPath);
}

// Parse robots.txt into an allowed(path) predicate for our UA.
function parseRobots(text, uaToken = UA_TOKEN) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === 'allow' || field === 'disallow') {
      if (!current) {
        current = { agents: ['*'], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: field, path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const pick =
    groups.find((g) => g.agents.some((a) => a !== '*' && uaToken.includes(a))) ||
    groups.find((g) => g.agents.includes('*'));
  const rules = pick ? pick.rules : [];

  return {
    allowed(urlPath) {
      // Longest matching rule wins; an empty Disallow path is "allow all".
      let decision = true;
      let bestLen = -1;
      for (const r of rules) {
        if (r.path === '') continue; // empty path constrains nothing
        if (matchRule(r.path, urlPath) && r.path.length > bestLen) {
          bestLen = r.path.length;
          decision = r.type === 'allow';
        }
      }
      return decision;
    },
  };
}

// Fetch + parse robots.txt for an origin. Fail-open (allow) on any error or
// missing file — that is the polite, spec-compliant default.
async function fetchRobots(origin) {
  const robotsUrl = origin.replace(/\/+$/, '') + '/robots.txt';
  try {
    await assertSafeUrl(robotsUrl);
    const res = await axios.get(robotsUrl, {
      timeout: TIMEOUT_MS,
      maxRedirects: 2,
      maxContentLength: MAX_BYTES,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 500,
      headers: { 'User-Agent': 'CirvA11yScanner/1.0' },
    });
    if (res.status >= 400) return parseRobots('');
    return parseRobots(String(res.data || ''));
  } catch {
    return parseRobots('');
  }
}

module.exports = { parseRobots, fetchRobots, matchRule, UA_TOKEN };
