# 02 — Cookie / GDPR-Consent Compliance Index

**One line:** A self-promoting open index of cookie/consent (GDPR + ePrivacy) readiness for EU e-commerce — the second compliance index built on the shared Cirv engine.

**Status:** engine ✅ · data pipeline ✅ (proven on real EU stores) · directory / API / deploy 🟢 next · started 2026-06-16.

## Why this exists
The accessibility index proved the engine is a **template**: crawl → score → directory → API → x402. This re-points it at a second compliance axis. Same fear-driven B2B buyer (GDPR fines are C-suite-level), huge search demand, no open index. ~80% of the code is reused; only the rule engine (`engine/cookies.js`) is new.

## The detection decision (conservative floor — read this)
Cookie/GDPR compliance is a **runtime** behaviour ("do trackers fire *before* consent?"). Static HTML can't fully see that. We chose **static heuristic detection** (v1) over a headless browser:

- We detect, from the markup: **trackers** (GA4, Meta Pixel, TikTok…), a **consent-management platform** (Cookiebot/OneTrust/Usercentrics…), and a **cookie notice**.
- The red flag = trackers present + **no** detectable CMP.
- **This is a conservative FLOOR, not a verdict.** JS-injected trackers are invisible to static scanning, so we *under-count* — we never falsely accuse. A score of 100 means **"no hardcoded red flags,"** NOT "GDPR compliant." All copy must say this.
- Upgrade path (later): headless runtime or a hybrid spot-check to verify pre-consent firing. ADR-worthy when traction justifies the infra.

## First real finding (2026-06-16, 39 EU stores)
- Average score 69/100. **33% (13 stores) hard-code trackers with no consent platform** — graded F.
- Complementary to accessibility: a store can pass one index and fail the other.

## Architecture (reused from 01)
`engine/cookies.js` (new rules) + `engine/fetch.js` (SSRF-safe, shared) → `src/` crawler/store/site (reused) → SQLite dataset → directory + API (next). `scan(html)` returns the same `{score,passes,fails,total,results}` shape, so the whole pipeline is unchanged.

## Build status
- [x] Cookie engine (`engine/cookies.js`) + 6 tests
- [x] Crawler repointed + real crawl → dataset
- [ ] Directory generator copy rebrand (cookie/GDPR framing, conservative-floor)
- [ ] Paid API (reuse `api/`) + Stripe
- [ ] Deploy (static directory + API) + n8n watchdog + Reddit engine
- [ ] Cross-link with the accessibility index (the network play)
