# cirv-cookie-index — implementation reference

Source revision: `e23adb20591a4caeb014f10411d769d0c842c0f9`. This reference records source declarations; it is not a transcript of a successful run.

## Entrypoint and runtime

[package.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/package.json) declares `bin/build-site.js`. Node.js `22.x` and npm.

## Supported workflow

Cookie/consent pattern detection; seeded crawler and SQLite store; directory generation; authenticated read API and usage limits.

HTML signatures cannot prove valid consent, detect every runtime cookie or establish GDPR compliance. Results are conservative screening signals. Crawling and optional Firecrawl/Stripe integrations make external requests.

## Crawler and site commands

Use Node.js 22.x. Install dependencies with `npm install`; the SQLite package includes a native component. The commands below operate on local dataset files except the crawler, which contacts seeded sites.

```sh
node bin/crawl.js seeds/eaa-ecommerce.sample.json --db data/index.db --concurrency 4
node bin/report.js --db data/index.db --json
node bin/build-site.js --db data/index.db --out public
```

| Command / option | Behavior and default |
| --- | --- |
| `crawl.js SEEDS` | JSON array, JSON object with `domains`, or text file with one domain per line; `#` comments are skipped in text |
| Crawl `--db PATH` | SQLite store; default `data/index.db` |
| Crawl `--concurrency N` | Parallel workers; default 4 |
| Crawl `--no-robots` | Disables the implemented robots check; do not use it to evade a site's access policy |
| Report `--db PATH` | Store to summarize; default `data/index.db` |
| Report `--json` | Latest domain rows as JSON instead of leaderboard/error summary |
| Build `--db PATH` | Input store; default `data/index.db` |
| Build `--out DIR` | Generated directory; default `public` |
| Build `--base URL` | Canonical site URL supplied to the generator |
| Build `--api-url URL` | API endpoint used by generated pages |
| Build `--mode MODE` | Site presentation mode; inspect generated output before publishing |
| Build `--analytics-provider NAME`, `--analytics-id ID` | Optional analytics configuration; also read from `ANALYTICS_PROVIDER` / `ANALYTICS_ID` |

`npm run refresh` combines the default crawl and site build; it is not a read-only preview. The dataset records normalized domain, scan status, timestamp and findings; error/skipped records must not be interpreted as compliant sites.

## Local API and storage

Run `npm run api` to start the API, default port `4000`. `DATA_DB` selects the dataset database; default `data/index.db`. `KEYS_DB` selects a separate credential database when set; otherwise keys share the dataset store. Preserve the keys database independently when refreshing disposable scan data. `CORS_ORIGINS` is a comma-separated browser-origin allowlist; CORS is not client authentication.

| Route | Input / authentication | Result |
| --- | --- | --- |
| `GET /livez` | None | `200`, `{"ok":true}` while process responds |
| `GET /readyz`, `GET /healthz` | None | `200` if datastore probes succeed; `503` with `{"ok":false}` otherwise |
| `POST /v1/signup` | JSON `email` | New key: `201` with `api_key`, `tier`, `note`; key shown once |
| `GET /v1/sites` | Bearer key; `limit` / `offset` query | `count`, `limit`, `offset`, `sites` |
| `GET /v1/sites/:domain` | Bearer key | Latest detailed domain record; `404` if absent |
| `GET /v1/usage` | Bearer key | `tier` and `rate_limit` |
| `POST /v1/billing/checkout` | JSON `email`, `tier`; configured Stripe | Checkout `url` |
| `POST /v1/billing/portal` | JSON `customer_id`; configured Stripe | Billing portal `url` |
| `POST /webhooks/stripe` | Raw body and valid Stripe signature | `{"received":true}` after handler dispatch |

`/v1/sites` defaults to 50 results and offset 0; limit is clamped to 1–200. Signup with an existing email returns `200`, `api_key: null` and a message rather than revealing an existing key. Store a new key when first issued.

Illustrative local read request after separately provisioning a key:

```sh
curl 'http://localhost:4000/v1/sites?limit=10' \
  -H "Authorization: Bearer $INDEX_API_KEY"
```

Quote the URL when adding `&offset=...` in a shell. `INDEX_API_KEY` here is a caller-side variable, not a server configuration key. Do not check real keys into examples.

## API errors and integration boundaries

| Status | Examples |
| --- | --- |
| `400` | Invalid signup email, unknown/unpriced tier, missing billing customer ID, invalid webhook signature |
| `401` | Missing or invalid bearer key on read routes |
| `404` | Domain not present in the index |
| `429` | Tier limit exceeded; response includes `error` and `tier` |
| `502` | Stripe checkout/portal creation failed |
| `503` | Billing unconfigured or datastore readiness failed |

Authenticated read responses set `X-RateLimit-Limit` and `X-RateLimit-Remaining`. `/v1/usage` returns the tier limit, not a complete remaining-usage ledger. Billing is disabled without `STRIPE_SECRET_KEY`; inspect `api/.env.example`, `api/tiers.js` and `api/stripe.js` for the configured price IDs and webhook secret. This document makes no current price or subscription-availability claim.

The billing portal route accepts a customer ID without the read-route bearer middleware in this revision. Add and verify an ownership/authentication boundary before exposing billing flows publicly; source presence is not production-readiness evidence.

## Package scripts

| Script | Exact command |
| --- | --- |
| `test` | `node engine/test.js && node test.js && node api/test.js` |
| `test:engine` | `node engine/test.js` |
| `test:crawl` | `node test.js` |
| `test:api` | `node api/test.js` |
| `crawl` | `node bin/crawl.js` |
| `report` | `node bin/report.js` |
| `build` | `node bin/build-site.js` |
| `refresh` | `node bin/crawl.js seeds/eaa-ecommerce.json && node bin/build-site.js` |
| `api` | `node api/server.js` |

## Environment references

The implementation reads `ANALYTICS_ID`, `ANALYTICS_PROVIDER`, `DATA_DB`, `FIRECRAWL_API_KEY`, `KEYS_DB`, `PORT`, `STRIPE_SECRET_KEY`. Some are optional or mode-specific; inspect their call sites before configuring a service. Credentials and endpoint values are never supplied by this document.

## Implementation sources

[api/server.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/server.js).

## Verification boundary

No repository code, tests, network operation, hook installer or migration was executed for this review. Source inspection supports the documented interface; runtime correctness and external-service compatibility remain unverified.
