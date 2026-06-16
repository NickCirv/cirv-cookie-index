'use strict';

// Static heuristic detector for cookie / consent (GDPR + ePrivacy) readiness.
// SIGNAL, not a verdict: static HTML cannot prove a tracker fires BEFORE consent.
// It detects, from the markup alone:
//   (a) third-party trackers, (b) a consent-management platform (CMP),
//   (c) a cookie/consent notice.
// The red flag is trackers present with no detectable CMP.
// Output mirrors the accessibility engine — scan(html) -> {score,passes,fails,total,results}
// — so the rest of the pipeline (crawler, store, directory, API) is reused unchanged.

const TRACKERS = [
  ['Google Analytics', /google-analytics\.com|googletagmanager\.com|gtag\(|\/gtag\/js|analytics\.js/i],
  ['Google Ads / DoubleClick', /doubleclick\.net|googlesyndication\.com|googleadservices\.com/i],
  ['Meta Pixel', /connect\.facebook\.net|fbevents\.js|fbq\(/i],
  ['TikTok Pixel', /analytics\.tiktok\.com|ttq\.(?:load|page|track)/i],
  ['LinkedIn Insight', /snap\.licdn\.com|_linkedin_partner_id/i],
  ['X / Twitter Pixel', /static\.ads-twitter\.com|twq\(/i],
  ['Microsoft Bing / Clarity', /bat\.bing\.com|clarity\.ms/i],
  ['Hotjar', /static\.hotjar\.com|hotjar\.com|hjid/i],
  ['Segment', /cdn\.segment\.com/i],
  ['Pinterest Tag', /pintrk\(|s\.pinimg\.com\/ct/i],
  ['Amplitude', /cdn\.amplitude\.com|amplitude\.getInstance/i],
  ['Mixpanel', /cdn\.mxpnl\.com|mixpanel/i],
  ['HubSpot', /js\.hs-scripts\.com|hs-analytics\.net/i],
  ['Criteo', /static\.criteo\.net/i],
];

const CMPS = [
  ['Cookiebot', /cookiebot\.com|consent\.cookiebot/i],
  ['OneTrust', /onetrust|otsdkstub|cookielaw\.org|optanon/i],
  ['Usercentrics', /usercentrics|app\.usercentrics/i],
  ['CookieYes', /cookieyes|cookie-law-info/i],
  ['iubenda', /iubenda\.com/i],
  ['Didomi', /didomi/i],
  ['Termly', /termly\.io/i],
  ['Klaro', /klaro/i],
  ['Osano', /osano\.com/i],
  ['Complianz', /complianz/i],
  ['Cookie Script', /cookie-script\.com/i],
  ['Quantcast', /quantcast|cmp\.choice/i],
  ['Borlabs', /borlabs-cookie/i],
  ['consentmanager', /consentmanager\.net/i],
  ['TrustArc', /trustarc\.com/i],
];

const BANNER =
  /we use cookies|accept all cookies|accept cookies|cookie policy|cookie settings|manage cookies|your privacy choices|cookie consent|consent to (?:the use of )?cookies|id=["'][^"']*cookie|class=["'][^"']*cookie|id=["'][^"']*consent|class=["'][^"']*consent/i;

function detect(html) {
  const h = String(html || '');
  const trackers = TRACKERS.filter(([, re]) => re.test(h)).map(([n]) => n);
  const cmps = CMPS.filter(([, re]) => re.test(h)).map(([n]) => n);
  const banner = BANNER.test(h);
  return { trackers, cmps, banner };
}

const list = (a) => a.slice(0, 6).join(', ') + (a.length > 6 ? `, +${a.length - 6} more` : '');

function scan(html) {
  const { trackers, cmps, banner } = detect(html);
  const hasTrackers = trackers.length > 0;
  const hasCmp = cmps.length > 0;
  const results = [];

  // 1 — Consent platform
  if (!hasTrackers) {
    results.push({ status: 'pass', check: 'Consent platform', message: 'No third-party trackers detected; a consent platform is not required.', element: '' });
  } else if (hasCmp) {
    results.push({ status: 'pass', check: 'Consent platform', message: `Consent platform detected (${list(cmps)}) alongside trackers.`, element: '' });
  } else {
    results.push({ status: 'fail', check: 'Consent platform', message: `Trackers detected (${list(trackers)}) but no consent-management platform found in the markup.`, element: '' });
  }

  // 2 — Cookie notice
  if (!hasTrackers) {
    results.push({ status: 'pass', check: 'Cookie notice', message: 'No trackers detected; a cookie notice is not strictly required.', element: '' });
  } else if (banner) {
    results.push({ status: 'pass', check: 'Cookie notice', message: 'A cookie/consent notice was detected in the markup.', element: '' });
  } else {
    results.push({ status: 'fail', check: 'Cookie notice', message: 'Trackers detected but no cookie/consent notice found in the markup.', element: '' });
  }

  // 3 — Tracker gating (heuristic proxy for "blocked before consent")
  if (!hasTrackers) {
    results.push({ status: 'pass', check: 'Tracker gating', message: 'No third-party trackers detected.', element: '' });
  } else if (hasCmp) {
    results.push({ status: 'pass', check: 'Tracker gating', message: `${trackers.length} tracker type(s) present with a consent platform — verify they are blocked before consent.`, element: '' });
  } else {
    results.push({ status: 'fail', check: 'Tracker gating', message: `${trackers.length} tracker type(s) load with no detectable consent gate.`, element: list(trackers) });
  }

  const passes = results.filter((r) => r.status === 'pass').length;
  const total = results.length;
  const fails = total - passes;
  const score = total ? Math.round((passes / total) * 100) : 0;
  return { score, passes, fails, total, results, trackers, cmps, banner };
}

module.exports = { scan, detect, TRACKERS, CMPS };
