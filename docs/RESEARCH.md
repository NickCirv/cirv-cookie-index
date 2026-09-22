# cirv-cookie-index — documentation research

Reviewed 21 September 2026. Public GitHub source only.

## Revision and scope

- Commit: [`e23adb20591a4caeb014f10411d769d0c842c0f9`](https://github.com/NickCirv/cirv-cookie-index/commit/e23adb20591a4caeb014f10411d769d0c842c0f9).
- Tree: `87421d7682d55ed2ef5457fc79def1f24bfa3021`; truncated: `false`.
- Capture: 33 of 33 eligible text files; all eligible text files.
- Method: package and entrypoint inspection, implementation-interface review, targeted behavior/limitation inspection, and test-source review. This is not an exhaustive correctness or security audit.
- Commands run against repository code: **none**. External services, deployment and npm publication were not verified.

## Claim and evidence map

| Documentation claim | Pinned evidence | Assessment |
| --- | --- | --- |
| Runtime, executable and development commands | [package.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/package.json) | Source declaration inspected; runtime unverified |
| Collects static cookie and consent-related signals from storefront homepages and publishes a Cirvgreen index. | [bin/build-site.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/build-site.js) · [src/crawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/crawl.js) | Implementation interfaces inspected; behavior not executed |
| Cookie/consent pattern detection; seeded crawler and SQLite store; directory generation; authenticated read API and usage limits. | [bin/build-site.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/build-site.js), [bin/crawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/crawl.js), [bin/report.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/report.js), [api/data.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/data.js), [api/keys.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/keys.js), [api/ratelimit.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/ratelimit.js), [api/server.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/server.js), [api/stripe.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/stripe.js) | Source-backed scope, not a test result |
| HTML signatures cannot prove valid consent, detect every runtime cookie or establish GDPR compliance. Results are conservative screening signals. Crawling and optional Firecrawl/Stripe integrations make external requests. | [bin/build-site.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/build-site.js), [bin/crawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/crawl.js), [bin/report.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/report.js), [api/data.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/data.js), [api/keys.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/keys.js), [api/ratelimit.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/ratelimit.js), [api/server.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/server.js), [api/stripe.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/stripe.js) | Material limits documented; service compatibility remains open |
| Existing checks | [test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/test.js), [api/test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/test.js), [engine/test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/engine/test.js) | Test source read; no passing-run claim |

## Documentation inventory and disposition

| Existing document | Decision |
| --- | --- |
| [README.md](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/README.md) | Rewritten with source-specific purpose, direct checkout setup, limitations and verification status. Old section fragments retained where practical. |

Added `docs/REFERENCE.md` for the observed implementation and command surface, and this research record. Protected license and attribution files remain in their original locations without edits. No source or product UI was changed.

## Quality dimensions

| Dimension | Status | Evidence / next step |
| --- | --- | --- |
| Pinned provenance | Verified | Captured commit, tree and per-file hashes recorded below |
| Interface documentation | Partially verified | Source inspection only; run clean-checkout quickstart |
| Runtime behavior | Unverified | No repository execution in this review |
| Test results | Unverified | Existing tests were not run |
| Deployment / package availability | Unverified | No remote publish or live-service check |
| Visual / link checks | Unverified | Portfolio renderer and independent QA are separate from this authoring step |

## Editorial follow-up

Added crawler/build/report and API route/error reference, including datastore readiness and missing billing ownership middleware boundary. Removed erroneous extracted test labels.

## Unresolved issues

HTML signatures cannot prove valid consent, detect every runtime cookie or establish GDPR compliance. Results are conservative screening signals. Crawling and optional Firecrawl/Stripe integrations make external requests.

## Captured source inventory

This lists captured provenance, not a claim that every line received a full audit. Binary/generated/excluded files are outside the eligible text capture.

| File | SHA-256 | Bytes |
| --- | --- | --- |
| [LICENSE](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/LICENSE) | `727fd30788861fa8b04ed63d129e14795af7f1f044ca20d92bedafc5014d649e` | 1084 |
| [README.md](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/README.md) | `84bcb7bdd29002808d48899efc898986301a243b2308b18841c321d11c87aafc` | 5936 |
| [package.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/package.json) | `eb7b784a91803917dea5a8c0ee3f58a8378d4fbe9973a0cb4018a3d3aaf9216d` | 840 |
| [.github/workflows/ci.yml](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/.github/workflows/ci.yml) | `3963422e7991643fb9dafe8d81a2e2d7b6fcf61b6b18985b8e5ba79a558f6272` | 366 |
| [.github/workflows/keepalive.yml](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/.github/workflows/keepalive.yml) | `e810231be7c3e8d3f1a1dc685e431322cfdaa3f342ef0363939d2c947002c794` | 543 |
| [.github/workflows/refresh.yml](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/.github/workflows/refresh.yml) | `fa37973e097ffa217be242f985766cac2c28cafde12f6006005a894c3a3fe1c1` | 1520 |
| [bin/build-site.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/build-site.js) | `5ce29fb1d00a761cfddda983cc5b802511d1a287cd175c844187c9e104dcb84f` | 1276 |
| [bin/crawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/crawl.js) | `44d5ef0bc1f8cbae9c22a2db47745fbe525546c8678e4f10edf61706bf1ead7c` | 2208 |
| [bin/report.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/bin/report.js) | `f5d0123fa4ee0ca39de1924c3a57f1dbe69c991c058504affac91535f3869159` | 1573 |
| [render.yaml](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/render.yaml) | `9475d7763c194ce5daa28bfdce381da792a967cf2690b92acebe428e4b777f73` | 1757 |
| [test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/test.js) | `c693d04e63b91574c4277111e98c99d90c0a861f7e40d77a722a1e728229b6ae` | 5945 |
| [api/.env.example](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/.env.example) | `9a51d44885cfc25974f53d1b788ea6f8c2a5dffce95ba52a0a422983e4922e7a` | 732 |
| [api/data.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/data.js) | `65a55b238ae09c8b2da29e0ace270129a01ffd17e9e4ea9403c42385d683d9ca` | 630 |
| [api/keys.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/keys.js) | `4c6e6fa485bbdbec606dc66dda413b1ddc4b6e1065fbc0ed786bcee7f179ec44` | 2880 |
| [api/ratelimit.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/ratelimit.js) | `cbbd450a547658b6aad0a65d7c531875a889ea96f5f6fc627e6e55769ed3339d` | 673 |
| [api/server.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/server.js) | `58fb4138799e67b8217960affc1448f8078f7df116311c6324685e29a4cd69ff` | 9071 |
| [api/stripe.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/stripe.js) | `7583c66ef5e6ddade9c843cb24599a0311acb329eefe1d76ec54af9e631bd270` | 1131 |
| [api/tiers.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/tiers.js) | `24d023c8d109b9958126e8a12a6d7a3fb65a72caae16315ef35f84f5a0c4e6e8` | 890 |
| [engine/cookies.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/engine/cookies.js) | `dd4e10d80184cd19f4caec8ae131147edecfaacb0ba395a8bc2864cdf382f861` | 4960 |
| [engine/fetch.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/engine/fetch.js) | `a1b702b86c527948d6cc90ef6439c04a0c881c811d550ffc233a082ee783a0fb` | 4139 |
| [public/data.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/public/data.json) | `3cf225ae53d641cfab8b57e4cbb53b1215f166dbb95541c71d2a1423dcd5d4ea` | 13792 |
| [seeds/eaa-ecommerce.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/seeds/eaa-ecommerce.json) | `b5bd2b516c55191099d8dc216844dcfed6e069febf84cf00c199ecee18d4a17e` | 1313 |
| [seeds/eaa-ecommerce.sample.json](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/seeds/eaa-ecommerce.sample.json) | `206142925069afbb7f619d6ae337d5de0d89f70214c1d4cecb6b1066dbd95bae` | 441 |
| [src/crawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/crawl.js) | `736096cdc814bbe848e601a9736dbfd4af5c82c4da23c20dd26dc6ec7b33f51b` | 4429 |
| [src/fetch.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/fetch.js) | `5d42936a0b1191494575eae5e1da71baf93a8c37d26c73bd6bcc8fdd1ea96d4e` | 4339 |
| [src/firecrawl.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/firecrawl.js) | `64d61850396ad0c095505dafc75ea21d68e1a04b6eea389da73faea75f837ceb` | 2291 |
| [src/limit.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/limit.js) | `9d10a9b8d0d15526e31ef41b0c6bc77ef962d99101710e465e6a95bcb870e6ac` | 651 |
| [src/robots.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/robots.js) | `0ce989c6072fbd0fb812c10123220b7df99ba115ffc6d74eba0d0150a2ed81f3` | 3274 |
| [src/seo-pages.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/seo-pages.js) | `f7c89ce4d7feceaf27115f4435761886389a0635db60f612d87ae924fc7d43fb` | 11030 |
| [src/site.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/site.js) | `9bdc999534c0533435f39b6b6eadd42e19ae48c25758e1eedf42f4421cb46cca` | 60439 |
| [src/store.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/src/store.js) | `d42e4ab6f13c9e4159857b0d9f56d2b140649243f4fa773e9b3e581378f286a5` | 2363 |
| [api/test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/api/test.js) | `cdfc0c6e202be0f06f8eeb9e67d55834ff3a93835a78acb092b58defbbfb920b` | 12121 |
| [engine/test.js](https://github.com/NickCirv/cirv-cookie-index/blob/e23adb20591a4caeb014f10411d769d0c842c0f9/engine/test.js) | `46040da9e36c5e2bd4415a8412bafceb0027b669d60e2fa630bbd3a57161ea13` | 2662 |

## Extended capture

The final capture includes 103 eligible text files, including HTML. Application pages and generated site output are preserved as product implementation, not rewritten as repository documentation. The final portfolio quality report verifies every captured file hash.
