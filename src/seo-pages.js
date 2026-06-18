'use strict';

// Programmatic SEO surface for the cookie/consent index, generated from the
// dataset: per-country hubs (/country/<slug>.html), a countries index, and a
// best-in-class list. Multiplies the indexable long-tail (e.g. "<country>
// cookie consent GDPR e-commerce") from the same data.
//
// IMPORTANT framing: the cookie score is a CONSERVATIVE FLOOR — static scanning
// catches hardcoded trackers / missing CMP / banner red flags, NOT JS-injected
// trackers. A high score = "no hardcoded red flags found", NOT "GDPR compliant".
// Copy below stays honest about that. Country is derived from the domain TLD.
// Helpers injected from site.js (no circular import). Soft mode hides D/F names.

const COUNTRY_BY_TLD = {
  de: 'Germany', fr: 'France', nl: 'Netherlands', it: 'Italy', es: 'Spain',
  se: 'Sweden', pl: 'Poland', be: 'Belgium', at: 'Austria', dk: 'Denmark',
  fi: 'Finland', pt: 'Portugal', ie: 'Ireland', cz: 'Czechia', gr: 'Greece',
  ro: 'Romania', hu: 'Hungary', sk: 'Slovakia', si: 'Slovenia', no: 'Norway',
};
const MIN_STORES_FOR_HUB = 2;

function countryOf(domain) {
  const d = String(domain).toLowerCase();
  if (/\.co\.uk$/.test(d)) return 'United Kingdom';
  const tld = d.split('.').pop();
  return COUNTRY_BY_TLD[tld] || 'International';
}

function countrySlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function groupByCountry(okRows) {
  const map = new Map();
  for (const r of okRows) {
    const c = countryOf(r.domain);
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(r);
  }
  const groups = [];
  for (const [country, rows] of map) {
    if (rows.length < MIN_STORES_FOR_HUB) continue;
    rows.sort((a, b) => (b.score || 0) - (a.score || 0));
    const avg = Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length);
    groups.push({ country, slug: countrySlug(country), rows, avg, total: rows.length });
  }
  groups.sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
  return groups;
}

function nameLink(r, mode, h) {
  const g = h.grade(r.score);
  const named = mode === 'named' || !(g === 'D' || g === 'F');
  return named
    ? `<a href="/sites/${h.esc(h.safeFile(r.domain))}.html">${h.esc(r.domain)}</a>`
    : '<span class="note">hidden — see report</span>';
}

function scoreTable(rows, mode, h) {
  const body = rows
    .map((r, i) => {
      const g = h.grade(r.score);
      return `<tr><td class="rank num">${i + 1}</td><td><span class="badge ${h.gradeClass(g)}">${h.esc(g)}</span></td><td>${nameLink(r, mode, h)}</td><td class="score num">${h.esc(r.score)}/100</td></tr>`;
    })
    .join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Grade</th><th>Store</th><th>Score</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderCountryHub(group, opts) {
  const { base, mode, h } = opts;
  const { country, slug, rows, avg, total } = group;
  const df = rows.filter((r) => ['D', 'F'].includes(h.grade(r.score))).length;
  const dfPct = total ? Math.round((df / total) * 100) : 0;
  const canonical = base + '/country/' + slug + '.html';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Cookie & consent red-flag scores for ${country} e-commerce homepages`,
    description: `Static cookie/consent compliance signals for ${total} online stores in ${country} (GDPR / ePrivacy). A conservative floor, not a compliance verdict.`,
    url: canonical,
    creator: { '@type': 'Organization', name: 'Cirvgreen', url: 'https://cirvgreen.com' },
  };
  const body = `
<section class="hero">
<p class="eyebrow">Country · ${h.esc(country)}</p>
<h1>Cookie &amp; consent compliance of ${h.esc(country)} online stores</h1>
<p class="lead">We checked ${h.esc(total)} e-commerce homepages based in ${h.esc(country)} for cookie/consent red flags — third-party trackers, a consent management platform, and a consent banner — under GDPR and the ePrivacy Directive.</p>
</section>
<div class="stats">
<div class="stat"><b>${h.esc(total)}</b><span>stores in ${h.esc(country)}</span></div>
<div class="stat"><b>${h.esc(avg)}<span class="note" style="font-size:1rem">/100</span></b><span>average score</span></div>
<div class="stat"><b>${h.esc(dfPct)}%</b><span>graded D or F</span></div>
<div class="stat"><b>GDPR</b><span>+ ePrivacy</span></div>
</div>
<h2>${h.esc(country)} store ranking</h2>
${scoreTable(rows, mode, h)}
<div class="cta">
<strong>How does your ${h.esc(country)} store score?</strong><br>
Read the methodology, or pull the full dataset via the API.
<br><a class="btn" href="/pricing.html">Get API access</a> &nbsp;<a href="/report.html">See the EU-wide report →</a>
</div>
<p class="note"><strong>A conservative floor:</strong> a high score means no <em>hardcoded</em> red flags — not that a store is GDPR compliant (static scanning can't see JS-injected trackers). See also: <a href="/countries.html">all countries</a> · <a href="/methodology.html">methodology</a>. Not legal advice.</p>`;
  return h.layout({
    title: `Cookie & GDPR Consent in ${country} — ${total} E-commerce Stores Checked`,
    description: `${total} ${country} online stores checked for cookie/consent red flags (GDPR, ePrivacy): average ${avg}/100, ${dfPct}% graded D or F. A conservative floor, ranked.`,
    canonical,
    jsonld,
    body,
  });
}

function renderCountriesIndex(groups, opts) {
  const { base, h } = opts;
  const canonical = base + '/countries.html';
  const rowsHtml = groups
    .map(
      (g) =>
        `<tr><td><a href="/country/${h.esc(g.slug)}.html">${h.esc(g.country)}</a></td><td class="num">${h.esc(g.total)}</td><td class="score num">${h.esc(g.avg)}/100</td></tr>`
    )
    .join('');
  const body = `
<section class="hero">
<p class="eyebrow">Index · By country</p>
<h1>EU e-commerce cookie compliance, by country</h1>
<p class="lead">Cookie-consent practices vary sharply by market. Pick a country to see how its online stores score on static GDPR / ePrivacy consent signals.</p>
</section>
<h2>Countries</h2>
<div class="tbl-wrap"><table><thead><tr><th>Country</th><th>Stores</th><th>Avg score</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
<p class="note">A conservative floor, not a compliance verdict. See also: <a href="/">the full index</a> · <a href="/report.html">EU-wide report</a> · <a href="/best.html">cleanest stores</a>.</p>`;
  return h.layout({
    title: 'Cookie & GDPR Consent by Country — EU E-commerce Index',
    description: 'Browse static cookie/consent compliance scores for EU e-commerce by country — Germany, France, Netherlands and more. GDPR & ePrivacy signals.',
    canonical,
    jsonld: null,
    body,
  });
}

function renderBestList(okRows, opts) {
  const { base, h } = opts;
  const canonical = base + '/best.html';
  const best = okRows
    .filter((r) => ['A', 'B'].includes(h.grade(r.score)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 25);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'EU e-commerce stores with the cleanest cookie/consent signals',
    itemListElement: best.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.domain })),
  };
  const rowsHtml = best
    .map(
      (r, i) =>
        `<tr><td class="rank num">${i + 1}</td><td><span class="badge ${h.gradeClass(h.grade(r.score))}">${h.esc(h.grade(r.score))}</span></td><td><a href="/sites/${h.esc(h.safeFile(r.domain))}.html">${h.esc(r.domain)}</a> <span class="note">(${h.esc(countryOf(r.domain))})</span></td><td class="score num">${h.esc(r.score)}/100</td></tr>`
    )
    .join('');
  const body = `
<section class="hero">
<p class="eyebrow">Ranking · Cleanest signals</p>
<h1>EU stores with the cleanest cookie/consent setup</h1>
<p class="lead">These ${h.esc(best.length)} European e-commerce homepages show the fewest static cookie/consent red flags — a consent banner and CMP present, no hardcoded trackers firing before consent.</p>
</section>
<h2>Top ${h.esc(best.length)} (grade A–B)</h2>
${best.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Grade</th><th>Store</th><th>Score</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` : '<p class="note">No A/B-grade stores in the current dataset.</p>'}
<div class="cta">
<strong>Want the full picture?</strong><br>
Pull the dataset via the API or browse by country.
<br><a class="btn" href="/pricing.html">Get API access</a> &nbsp;<a href="/countries.html">Browse by country →</a>
</div>
<p class="note"><strong>Conservative floor:</strong> a clean static score is necessary but not sufficient for GDPR compliance — it can't see JS-injected trackers. <a href="/methodology.html">Methodology</a>.</p>`;
  return h.layout({
    title: 'EU Stores with the Cleanest Cookie/Consent Setup — Cirv Cookie Index',
    description: `The ${best.length} EU e-commerce homepages with the fewest static cookie/consent red flags (GDPR, ePrivacy). A conservative floor, ranked.`,
    canonical,
    jsonld,
    body,
  });
}

// llms.txt — the AI-citation map (llmstxt.org). Generated from the data so it
// stays current every refresh. Stays honest about the conservative-floor caveat.
function renderLlms(s, opts) {
  const base = opts.base;
  return [
    '# Cirv Cookie and Consent Index',
    '',
    '> Open index of cookie/consent compliance signals across EU e-commerce homepages (GDPR and ePrivacy). ' + s.total + ' stores checked; average ' + s.avg + '/100; ' + s.dfPct + '% grade D or F. Updated ' + s.updated + '. A conservative static floor, not a compliance verdict. Free, citable open data by Cirvgreen.',
    '',
    '## Key resources',
    '- [Report](' + base + '/report.html): headline findings and grade distribution.',
    '- [Dataset, JSON](' + base + '/data.json): every store score, grade, and top gap.',
    '- [By country](' + base + '/countries.html): per-country consent breakdowns.',
    '- [Methodology](' + base + '/methodology.html): what is checked and the limits.',
    '',
    '## Headline numbers (current, citable)',
    '- ' + s.total + ' EU e-commerce homepages checked for cookie/consent red flags (GDPR, ePrivacy).',
    '- Average score ' + s.avg + '/100; ' + s.dfPct + '% graded D or F.',
    '- Most common gap: ' + s.topFail + ' (' + s.topFailPct + '% of stores).',
    '',
    '## How to cite',
    'Cirv Cookie and Consent Index (Cirvgreen), ' + base + '/, dataset at ' + base + '/data.json, accessed ' + s.updated + '. License: CC BY 4.0.',
    '',
    '## Important caveat for AI and researchers',
    'This is a conservative static floor. A static scan cannot see trackers injected by JavaScript after load, so a high score means no hardcoded red flags were found, NOT that a store is GDPR compliant. It under-counts and never over-accuses. Not legal advice.',
    '',
  ].join('\n');
}

module.exports = { countryOf, countrySlug, groupByCountry, renderCountryHub, renderCountriesIndex, renderBestList, renderLlms };
