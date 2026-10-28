# Economic Improvement, Phase 0 baseline and repository inventory

Base commit: `e53cba80f14f43a93c29d89d4b589f9bc3786960` (`economic-improvement`). World configuration revision: **0**. Seed: `BENCHMARK-COAST-01`. This phase changes no runtime game code or benchmark recipe.

## Reproduce

From the repository root, with Node 24 and Python 3:

```sh
node --test tests/economic-improvement-phase0.test.mjs
node --expose-gc scripts/economic-improvement-baseline.mjs > docs/economic-improvement/baseline-node.json
python3 -m http.server 8000 --directory dist
```

The last command serves the development build at `http://localhost:8000`. There is no transpile/build command: `dist/` contains the browser modules, data and bundled Pixi. The local HTTP smoke check returned 200 with complete bodies for `index.html`, `app.js`, `data/catalog-bundle.js`, and `paper.png`; it does not establish successful WebGL rendering or interactive startup.

The checked-in [Node baseline](baseline-node.json) invokes the actual `generator.worker.js` message handler in one Node process with a revision-0 world snapshot. It is one cold pass per size, not a cross-device performance result. Milliseconds are rounded to 0.01. This Linux container reports 9.73 GiB system memory; CPU model and logical CPU count are unavailable here. V8 heap is process-wide after that scene; this environment's `process.memoryUsage()` fails because resident-memory reporting is unavailable, so RSS and external/buffer bytes are null.

| Size | Islands | Eligible small / large dock edges | Islands with eligible small / large edges | Ports | Industries | Terrain ms | Worker generation ms | Handler setup ms | V8 heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | 1 | 36 / 42 | 1 / 1 | 0 | 0 | 8.22 | 24.21 | 24.98 | 13.43 |
| 128 | 45 | 1,932 / 2,194 | 45 / 45 | 23 | 25 | 59.38 | 185.71 | 185.99 | 14.15 |
| 512 | 715 | 30,686 / 36,047 | 715 / 715 | 377 | 382 | 495.50 | 2,216.01 | 2,216.45 | 13.36 |

An eligible edge means an adjacent land/water pair accepted by the present `dockFootprint` geometry. It is an upper bound: it does not account for settlement area, a founded industry's terrain, a safe capital-ship route, uniqueness, or the two-island faction draft. The 32 map's one surviving island has 0 ports because the current port minimum and other placement constraints reject it. Subsequent phases must check actual feasible colony assignments, not just these counts. `workerGenerationMs` includes terrain, shore, ports, and industries. `handler setup ms` also includes dispatch and excludes real cross-thread transfer/cloning.

## Fixed browser simulation reference

The user supplied this **earlier** unchanged `pirates-merchants-benchmark-v7` simulation report from the Phase 2 merged build, captured 2026-10-22T09:50:28.760Z. It is a reference on one browser, not a fresh run on this Phase 0 branch. The complete report was supplied in our conversation; these values preserve its comparison fields without changing the benchmark. Re-run the same button and viewport on that device when a later phase changes relevant simulation behavior.

| Environment and recipe | Value |
| --- | --- |
| Device / browser | Windows 10 Win32, Brave (reported GL vendor and renderer); user agent Chromium 155; 8 GiB device memory, 8 hardware threads |
| Screen / DPR | 1920 × 1080 / 1 |
| Viewport / output / filter | 1879 × 820 / 1879 × 820 / 1 |
| Seed / world settings | BENCHMARK-COAST-01; 512; density 48, scale 50, roughness 55, moisture 60, mountains 35, industry density 50 |
| View / zoom / apparent hex width | Coast / 32 / 55.43 pixels |
| Fleet / duration | 50 requested merchants, 50 actual, 62 total ships; 30 s at 1× then 30 s at 20×, including 1.5 s warmup each; 60,020.8 ms total |
| World config revision / GPU timer | 0 / available for this browser run |

| Speed | Frame median / p95 ms | GPU median / p95 ms | Ticker median / p95 ms | Worker tick median / p95 ms | Message rate Hz / median sampled bytes | Long task ms | Browser JS heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1× | 16.7 / 16.9 | 13.33 / 15.75 | 0.5 / 8.1 | 20.1 / 58.01 | 7.65 / 67,630.5 | 370 | 57.47 |
| 20× | 16.7 / 16.9 | 15.93 / 18.4 | 1.3 / 6.1 | 33.65 / 51.33 | 6.11 / 78,342 | 387 | 101.06 |

That report measured main-thread generation at 1,049.7 ms and worker generation at 3,276.1 ms for its browser, which are not comparable with the Node timings above. Frame intervals include scheduling; GPU timer measures full app rendering where available. The fixed world benchmark remains available through its separate menu button, but no same-device world browser report is available in this checkout or this turn. Do not infer a browser world baseline from the Node data.

## Source and startup inventory

| Area | Current authority and route |
| --- | --- |
| Source catalogs | `dist/data/*.json`: `commodities`, `vessels`, `industries`, `assets`, `factions`, `naming`, `settlements`, `settings`, `docks`, `town_buildings`, `roads`, `colony_presets`, `configuration_definitions`, `configuration_overrides`, `configuration_constraints`, and `catalog.schema.json`. `port-names.json` is a legacy fixture. |
| Browser bundle | `dist/data/catalog-bundle.js` contains compiled catalog and schema for synchronous browser loading. `dist/catalog-loader.js` reads JSON in Node, validates schema/references, and clones the bundle in the browser. The new check compares both, so future source/bundle edits must be synchronized. |
| Asset packing | Renderable assets reside under `dist/` and `dist/gfx/`; art descriptions and some retired art are in `docs/`. No packer or source drawing project is present in this checkout. `docs/phase-1-data-assets.md` names `scripts/validate-data.mjs`, but `scripts/` was absent before this phase. Track/recover the original packer or add a repeatable one when introducing new art. |
| World path | `dist/bootstrap.js` loads the module app. `dist/app.js` sends settings and a validated revisioned world snapshot to module `dist/generator.worker.js`. Worker generates terrain (`world.js`), shore, ports and industries, transfers typed arrays, then `app.js` sets up renderer/world UI. |
| Fleet path | `dist/app.js` invokes `MerchantTraffic.start()`; `dist/merchant-traffic.js` sends a structured-cloned world and density to `dist/merchant.worker.js`. The normal Simulate button still reads `merchant-density`. The fixed simulation benchmark explicitly sets density 50 after generating only the 512 map. |
| Dock/sailing/accounting | `dist/data/docks.json`, `port-infrastructure.js`, `dock-traffic.js`, `navigation-safety.js`, `ships.js`, and `economic-accounts.js`. Existing catalogs define `small_pier` and `deep_water_quay`; footprint/berth/safe-hull checks are distinct. |

## Checks and limitations

`node --test tests/economic-improvement-phase0.test.mjs`: **5 passed, 0 failed**. Exercises seeded geography/ports, actual dock footprint and ship-size compatibility plus safe spawn, conserved funded transfer and failed-payment rollback, fixed benchmark route/recipe sentinels, catalog/bundle equality, and referenced art paths. The benchmark sentinels protect today's recipe but are static checks, not a browser benchmark. Node's source-catalog validation ran as part of these checks and the baseline worker import.

The README names `tests/world.test.mjs`, `tests/ports.test.mjs`, `tests/economy.test.mjs`, `tests/capital-docking.test.mjs`, `tests/phase0.test.mjs`, `tests/phase1.test.mjs`, `tests/phase2a.test.mjs`, `tests/render_shader.py`, and further suites. None of the named files are in this checkout; `tests/` was empty at Phase 0 start. Its references do not identify an external location or retrieval route. No such suite is claimed to have passed. This focused harness is deliberately smaller than those historical suites. Browser interaction, actual Worker startup latency, WebGL art/render checks, cargo conservation, and true capital-vessel approach/departure remain unverified and belong in implementation phase checks. The phase branch should remain reviewable as a runnable static build and baseline, without claiming the new economy works.
