'use strict';

// API tests — no framework, no network, no live Stripe. Run: node api/test.js
const assert = require('assert');
const http = require('http');
const { openStore } = require('../src/store');
const { recordScan } = require('../src/store');
const { TIERS, priceForTier, tierForPrice } = require('./tiers');
const { ensureKeysTable, issueKey, hashKey, findByHash, findByEmail, upgradeOrIssue } = require('./keys');
const { checkLimit, _reset } = require('./ratelimit');
const { createApp, handleEvent } = require('./server');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.then(() => { console.log(`  ok  ${name}`); pass++; }, (e) => { console.error(`  FAIL ${name}\n       ${e.stack || e.message}`); fail++; });
    console.log(`  ok  ${name}`); pass++;
  } catch (e) { console.error(`  FAIL ${name}\n       ${e.stack || e.message}`); fail++; }
};

// fire a single request against the app (listen on ephemeral port, close after)
function request(app, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const data = body !== undefined ? JSON.stringify(body) : null;
      const h = { ...headers };
      if (data) { h['content-type'] = 'application/json'; h['content-length'] = Buffer.byteLength(data); }
      const req = http.request({ host: '127.0.0.1', port, path, method, headers: h }, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => { server.close(); let j; try { j = JSON.parse(buf); } catch { j = buf; } resolve({ status: res.statusCode, body: j, headers: res.headers }); });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

const ENV = { STRIPE_PRICE_STARTER: 'price_starter', STRIPE_PRICE_PRO: 'price_pro', STRIPE_WEBHOOK_SECRET: 'whsec', API_BASE_URL: 'https://x.test', CORS_ORIGINS: 'https://allowed.test' };
const fakeStripe = {
  checkout: { sessions: { create: async () => ({ url: 'https://stripe.test/checkout' }) } },
  billingPortal: { sessions: { create: async () => ({ url: 'https://stripe.test/portal' }) } },
  webhooks: { constructEvent: (body) => JSON.parse(Buffer.isBuffer(body) ? body.toString() : body) },
};
function seedDb() {
  const db = openStore(':memory:');
  recordScan(db, { domain: 'shop-a.com', status: 'ok', score: 90, passes: 9, fails: 1, total: 10, results: [{ status: 'fail', check: 'Alt Text', wcag: 'A', message: 'm', element: '' }], scanned_at: 100 });
  recordScan(db, { domain: 'shop-b.com', status: 'ok', score: 40, passes: 4, fails: 6, total: 10, results: [], scanned_at: 100 });
  return db;
}

async function run() {
  // ---- tiers ----
  t('priceForTier / tierForPrice round-trip', () => {
    assert.strictEqual(priceForTier('starter', ENV), 'price_starter');
    assert.strictEqual(tierForPrice('price_pro', ENV), 'pro');
    assert.strictEqual(tierForPrice('nope', ENV), null);
    assert.strictEqual(priceForTier('free', ENV), null);
  });

  // ---- keys ----
  t('issueKey + findByHash + hashKey', () => {
    const db = openStore(':memory:'); ensureKeysTable(db);
    const raw = issueKey(db, { email: 'a@b.com', tier: 'free' }, 1);
    assert(raw.startsWith('cirv_'));
    const rec = findByHash(db, hashKey(raw));
    assert(rec && rec.email === 'a@b.com' && rec.tier === 'free');
    assert.strictEqual(findByHash(db, hashKey('wrong')), undefined);
    db.close();
  });
  t('upgradeOrIssue upgrades an existing email in place', () => {
    const db = openStore(':memory:'); ensureKeysTable(db);
    const raw = issueKey(db, { email: 'c@d.com', tier: 'free' }, 1);
    const ret = upgradeOrIssue(db, { email: 'c@d.com', customerId: 'cus_1', tier: 'pro' }, 2);
    assert.strictEqual(ret, null, 'no new key when upgrading');
    const rec = findByHash(db, hashKey(raw));
    assert.strictEqual(rec.tier, 'pro');
    assert.strictEqual(rec.customer_id, 'cus_1');
    db.close();
  });

  // ---- rate limit ----
  t('checkLimit allows under, blocks over, resets next day', () => {
    _reset();
    const day0 = 1000;
    assert.strictEqual(checkLimit('k', 2, day0).allowed, true);
    assert.strictEqual(checkLimit('k', 2, day0).allowed, true);
    assert.strictEqual(checkLimit('k', 2, day0).allowed, false);
    assert.strictEqual(checkLimit('k', 2, day0 + 86400000).allowed, true, 'resets next day');
  });

  // ---- webhook entitlement ----
  t('handleEvent: checkout.session.completed provisions a tier', () => {
    const db = openStore(':memory:'); ensureKeysTable(db);
    handleEvent(db, { type: 'checkout.session.completed', data: { object: { customer_email: 'e@f.com', customer: 'cus_9', metadata: { tier: 'starter' } } } }, ENV, 5);
    const rec = findByEmail(db, 'e@f.com');
    assert(rec && rec.tier === 'starter' && rec.customer_id === 'cus_9');
    db.close();
  });
  t('handleEvent: subscription.deleted downgrades to free', () => {
    const db = openStore(':memory:'); ensureKeysTable(db);
    issueKey(db, { email: 'g@h.com', customerId: 'cus_x', tier: 'pro' }, 1);
    handleEvent(db, { type: 'customer.subscription.deleted', data: { object: { customer: 'cus_x' } } }, ENV, 5);
    assert.strictEqual(findByEmail(db, 'g@h.com').tier, 'free');
    db.close();
  });

  // ---- HTTP integration ----
  await t('healthz', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r = await request(app, 'GET', '/healthz');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });
  await t('signup issues a free key once; second call returns null', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r1 = await request(app, 'POST', '/v1/signup', { body: { email: 'new@user.com' } });
    assert.strictEqual(r1.status, 201);
    assert(r1.body.api_key && r1.body.api_key.startsWith('cirv_'));
    const r2 = await request(app, 'POST', '/v1/signup', { body: { email: 'new@user.com' } });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.body.api_key, null);
  });
  await t('signup rejects bad email', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r = await request(app, 'POST', '/v1/signup', { body: { email: 'nope' } });
    assert.strictEqual(r.status, 400);
  });
  await t('data endpoints require a valid key', async () => {
    _reset();
    const db = seedDb();
    const app = createApp({ db, stripe: fakeStripe, env: ENV });
    assert.strictEqual((await request(app, 'GET', '/v1/sites')).status, 401);
    assert.strictEqual((await request(app, 'GET', '/v1/sites', { headers: { authorization: 'Bearer cirv_wrong' } })).status, 401);
    const raw = issueKey(db, { email: 'k@k.com', tier: 'free' }, 1);
    const ok = await request(app, 'GET', '/v1/sites', { headers: { authorization: 'Bearer ' + raw } });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.count, 2);
    assert.strictEqual(ok.body.sites[0].domain, 'shop-a.com'); // best score first
    assert.strictEqual(ok.body.sites[0].grade, 'A');
  });
  await t('site detail returns findings', async () => {
    _reset();
    const db = seedDb();
    const app = createApp({ db, stripe: fakeStripe, env: ENV });
    const raw = issueKey(db, { email: 'd@d.com', tier: 'free' }, 1);
    const r = await request(app, 'GET', '/v1/sites/shop-a.com', { headers: { authorization: 'Bearer ' + raw } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.domain, 'shop-a.com');
    assert(Array.isArray(r.body.findings) && r.body.findings.length === 1);
  });
  await t('checkout returns a Stripe URL', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r = await request(app, 'POST', '/v1/billing/checkout', { body: { tier: 'starter', email: 'buy@er.com' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.url, 'https://stripe.test/checkout');
  });
  await t('checkout rejects unknown tier', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r = await request(app, 'POST', '/v1/billing/checkout', { body: { tier: 'enterprise', email: 'buy@er.com' } });
    assert.strictEqual(r.status, 400);
  });
  await t('billing returns 503 when Stripe not configured', async () => {
    const app = createApp({ db: seedDb(), stripe: null, env: ENV });
    const r = await request(app, 'POST', '/v1/billing/checkout', { body: { tier: 'starter', email: 'x@y.com' } });
    assert.strictEqual(r.status, 503);
  });

  await t('CORS: preflight allowed origin → 204 + ACAO header', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const pre = await request(app, 'OPTIONS', '/v1/sites', { headers: { origin: 'https://allowed.test', 'access-control-request-method': 'GET' } });
    assert.strictEqual(pre.status, 204);
    assert.strictEqual(pre.headers['access-control-allow-origin'], 'https://allowed.test');
  });
  await t('CORS: unlisted origin gets no ACAO header', async () => {
    const app = createApp({ db: seedDb(), stripe: fakeStripe, env: ENV });
    const r = await request(app, 'GET', '/healthz', { headers: { origin: 'https://evil.test' } });
    assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run();
