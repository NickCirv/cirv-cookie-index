'use strict';

// Engine tests — deterministic fixtures, no network. Run: node engine/test.js
const assert = require('assert');
const { scan, detect } = require('./cookies');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ok  ${name}`); pass++; }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); fail++; }
};

const withTrackerNoCmp = `<html><head>
  <script src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>
  <script>fbq('init','123');</script>
</head><body>shop</body></html>`;

const withTrackerCmpBanner = `<html><head>
  <script src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>
  <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"></script>
</head><body><div class="cookie-banner">We use cookies. Accept all cookies?</div></body></html>`;

const clean = `<html><head><title>shop</title></head><body><h1>welcome</h1></body></html>`;

const customBannerNoCmp = `<html><head>
  <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
</head><body><div id="cookie-consent">We use cookies. Accept cookies</div></body></html>`;

t('detect finds trackers + cmp + banner', () => {
  const d = detect(withTrackerCmpBanner);
  assert(d.trackers.includes('Google Analytics'));
  assert(d.cmps.includes('Cookiebot'));
  assert.strictEqual(d.banner, true);
});

t('trackers + no CMP + no banner = score 0 (red flag)', () => {
  const r = scan(withTrackerNoCmp);
  assert.strictEqual(r.score, 0, `expected 0 got ${r.score}`);
  assert(r.results.some((x) => x.check === 'Consent platform' && x.status === 'fail'));
  assert(r.trackers.length >= 2);
});

t('trackers + CMP + banner = score 100', () => {
  const r = scan(withTrackerCmpBanner);
  assert.strictEqual(r.score, 100, `expected 100 got ${r.score}`);
});

t('clean site (no trackers) = score 100', () => {
  const r = scan(clean);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.trackers.length, 0);
});

t('custom banner, tracker, no CMP = partial (notice passes, platform/gating fail)', () => {
  const r = scan(customBannerNoCmp);
  assert.strictEqual(r.score, 33, `expected 33 got ${r.score}`);
  assert(r.results.find((x) => x.check === 'Cookie notice').status === 'pass');
  assert(r.results.find((x) => x.check === 'Consent platform').status === 'fail');
});

t('output shape matches the accessibility engine', () => {
  const r = scan(clean);
  assert(['score', 'passes', 'fails', 'total', 'results'].every((k) => k in r));
  assert(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
