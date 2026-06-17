'use strict';

// Cirv Accessibility Index API — the paid data layer.
// createApp({ db, stripe, env, now }) is fully injectable so tests run offline.

const express = require('express');
const { latestScans, getSiteLatest, normalizeDomain } = require('./data');
const { grade, topIssue } = require('../src/site');
const {
  ensureKeysTable, hashKey, findByHash, findByEmail, issueKey,
  setTierByCustomer, revokeByCustomer, upgradeOrIssue,
} = require('./keys');
const { TIERS, priceForTier, tierForPrice } = require('./tiers');
const { checkLimit } = require('./ratelimit');
const { createCheckout, createPortal, verifyWebhook } = require('./stripe');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function summary(r) {
  return {
    domain: r.domain,
    status: r.status,
    score: r.score,
    grade: grade(r.score),
    fails: r.fails,
    passes: r.passes,
    top_issue: topIssue(r.results_json),
    scanned_at: r.scanned_at,
  };
}

function detail(r) {
  let findings = [];
  try {
    findings = JSON.parse(r.results_json || '[]');
  } catch {
    findings = [];
  }
  return { ...summary(r), final_url: r.final_url, findings };
}

// Stripe webhook → entitlement changes.
function handleEvent(db, event, env, now) {
  const obj = event.data && event.data.object ? event.data.object : {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const email = obj.customer_email || (obj.customer_details && obj.customer_details.email) || null;
      const tier = (obj.metadata && obj.metadata.tier) || 'starter';
      upgradeOrIssue(db, { email, customerId: obj.customer, tier }, now);
      break;
    }
    case 'customer.subscription.updated': {
      const priceId = obj.items && obj.items.data && obj.items.data[0] && obj.items.data[0].price && obj.items.data[0].price.id;
      const tier = tierForPrice(priceId, env) || (obj.metadata && obj.metadata.tier);
      if (tier && obj.customer) setTierByCustomer(db, obj.customer, tier, now);
      break;
    }
    case 'customer.subscription.deleted':
      if (obj.customer) revokeByCustomer(db, obj.customer, now);
      break;
    default:
      break;
  }
}

function createApp(opts) {
  const { db, stripe = null, env = process.env } = opts;
  const now = opts.now || (() => Date.now());
  const keysDb = opts.keysDb || db; // keys persist separately from the (rebuildable) dataset
  ensureKeysTable(keysDb);
  const app = express();
  app.disable('x-powered-by');

  // Webhook FIRST — needs the raw body for signature verification.
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'billing not configured' });
    let event;
    try {
      event = verifyWebhook(stripe, req.body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ error: 'invalid signature' });
    }
    try {
      handleEvent(keysDb, event, env, now());
    } catch (e) {
      console.error('webhook handler error:', e && e.message);
    }
    return res.json({ received: true });
  });

  // CORS — the pricing page (static directory, different origin) calls this API
  // from the browser. Allow-list origins via CORS_ORIGINS (comma-separated), or '*'.
  const allowed = String(env.CORS_ORIGINS || 'https://cookies.cirvgreen.com,https://cirv-cookie-index.onrender.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowed.includes('*') || allowed.includes(origin))) {
      res.set('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.use(express.json({ limit: '16kb' }));

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // Free self-serve key (funnel entry).
  app.post('/v1/signup', (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'valid email required' });
    if (findByEmail(keysDb, email)) {
      return res.status(200).json({ api_key: null, message: 'A key already exists for this email.' });
    }
    const raw = issueKey(keysDb, { email, tier: 'free' }, now());
    return res.status(201).json({ api_key: raw, tier: 'free', note: 'Store this key now — it is shown only once.' });
  });

  // Auth + per-tier rate limit.
  function auth(req, res, next) {
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'missing API key' });
    const rec = findByHash(keysDb, hashKey(m[1].trim()));
    if (!rec) return res.status(401).json({ error: 'invalid API key' });
    const def = TIERS[rec.tier] || TIERS.free;
    const rl = checkLimit(rec.key_hash, def.rateLimit, now());
    res.set('X-RateLimit-Limit', String(def.rateLimit));
    res.set('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) return res.status(429).json({ error: 'rate limit exceeded', tier: rec.tier });
    req.key = rec;
    next();
  }

  app.get('/v1/usage', auth, (req, res) =>
    res.json({ tier: req.key.tier, rate_limit: (TIERS[req.key.tier] || TIERS.free).rateLimit })
  );

  app.get('/v1/sites', auth, (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const all = latestScans(db);
    res.json({ count: all.length, limit, offset, sites: all.slice(offset, offset + limit).map(summary) });
  });

  app.get('/v1/sites/:domain', auth, (req, res) => {
    const row = getSiteLatest(db, normalizeDomain(req.params.domain));
    if (!row) return res.status(404).json({ error: 'domain not in index' });
    res.json(detail(row));
  });

  app.post('/v1/billing/checkout', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'billing not configured' });
    const tier = String((req.body && req.body.tier) || '');
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const priceId = priceForTier(tier, env);
    if (!priceId) return res.status(400).json({ error: 'unknown or unpriced tier' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'valid email required' });
    try {
      const session = await createCheckout(stripe, {
        priceId, email, tier,
        successUrl: (env.API_BASE_URL || '') + '/success',
        cancelUrl: (env.API_BASE_URL || '') + '/pricing',
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error('checkout error:', e && e.message);
      res.status(502).json({ error: 'could not start checkout' });
    }
  });

  app.post('/v1/billing/portal', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'billing not configured' });
    const customerId = String((req.body && req.body.customer_id) || '');
    if (!customerId) return res.status(400).json({ error: 'customer_id required' });
    try {
      const portal = await createPortal(stripe, { customerId, returnUrl: (env.API_BASE_URL || '') + '/account' });
      res.json({ url: portal.url });
    } catch (e) {
      console.error('portal error:', e && e.message);
      res.status(502).json({ error: 'could not open portal' });
    }
  });

  return app;
}

module.exports = { createApp, handleEvent, summary, detail };

// ---- standalone wiring ----
if (require.main === module) {
  const path = require('path');
  const { openStore } = require('./data');
  const { getStripe } = require('./stripe');
  const dbPath = process.env.DATA_DB || path.join(__dirname, '..', 'data', 'index.db');
  const db = openStore(dbPath);
  const keysDb = process.env.KEYS_DB ? openStore(process.env.KEYS_DB) : db;
  const stripe = process.env.STRIPE_SECRET_KEY ? getStripe(process.env.STRIPE_SECRET_KEY) : null;
  if (!stripe) console.warn('STRIPE_SECRET_KEY not set — billing endpoints return 503.');
  const app = createApp({ db, keysDb, stripe, env: process.env });
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Cirv Index API on :${port}`));
}
