# Economic Improvement configuration, subphase 1.1

Base commit: `5430506ff7a0deb9d9111fce48219b5ba680f731` (`economic-improvement` after Phase 0). World configuration revision: **0** by default; serialized snapshots carry their own revision and format version 1. This document covers 1.1 only. Compilation, snapshot routing, UI, and explicit benchmark profile are Phase 1.2.

## Source contract

The authoritative 41 `opening.*` definitions are in `dist/data/configuration_definitions.json`. The existing registry supports booleans, bounded integers and enumerated string choices; no new configuration type is needed. The source schema in `dist/data/catalog.schema.json` bounds enum option lists and requires nonempty definitions. `node scripts/compile-catalogs.mjs` validates source catalogs/defaults then regenerates `dist/data/catalog-bundle.js`; add `--check` to fail if stale. The generated browser bundle is 111,148 bytes versus 96,226 bytes at the base commit, an additional 14,922 bytes uncompressed. The browser and worker already consume revisioned world snapshots; neither has yet been changed to use this opening section.

| Group | Defaults and validation |
| --- | --- |
| Mode and participants | `opening.enabled=false`. British and Spanish enabled, French and Pirates disabled. At least two nationals must be selected. Pirates do not count. |
| Founding counts | Two colonies per faction; one crown and one small per national; two small per Pirate; one industry per colony. A national crown has one warship and two merchants, a national small colony has one merchant, and each Pirate colony has one ship. These are fixed-range settings for the agreed opening, present in snapshots for later consumers. |
| Docks and vessels | Crown `deep_water_quay` and `FIRST_RATE` (catalog Man-of-War), with `BRIGANTINE` and `SCHOONER` merchant defaults. Small colonies use `small_pier` and `SCHOONER`, with `BRIGANTINE` as a compatible alternate merchant class. Pirate class ID `CORSAIR` is reserved by the opening contract but has no catalog vessel yet. Unknown/unsupported enum choices, incompatible berth sizes and incorrect vessel roles are rejected. |
| Industry policy | `foundation_three` names the required sawmill, iron mine and cotton plantation coverage. Sawmill is not yet registered; activating the new opening fails clearly until Phase 2 delivers it. |
| Finite founding grants | Per-faction treasury 5,000 gold; crown port 500 gold; small port 250 gold; bootstrap 200 Wood, 80 Iron Bars and 0 Cotton. These are configuration proposals only: no grant or stock is created in 1.1. Phase 6 must specify ownership and reconcile each grant. Negative values are rejected. |
| Shipyard | Small/medium/large minimum population 100/300/600; Wood 40/100/200; Iron Bars 0/40/100. Thresholds must not decrease by tier. They are not construction recipes until Phase 9. |
| Anchorage | Minimum/preferred/maximum coast distance 2/5/12 world units; minimum depth 6. Distance ordering and numeric bounds are validated; actual clearance is a runtime concern. |

All settings are world-scoped and apply to a new world. The four participation toggles are marked user settable for the later world-generation selector. The other settings remain developer-owned. The accepted `CORSAIR` enum token is a documented future identifier; choosing it cannot activate Pirate founding until the actual Pirate vessel is registered. Faction placement and island capacity are not inferred from these settings. Phase 3 will reject map-specific impossible combinations.

## Verification and limits

Commands: `node scripts/compile-catalogs.mjs --check` and `node --test tests/economic-improvement-phase0.test.mjs tests/economic-improvement-phase1-config.test.mjs`. At 1.1 completion: 10 focused tests pass, 0 fail. They cover snapshot roundtrip, two-national selection, ID and bound rejection, catalog-backed berth compatibility, gated unimplemented dependencies, prior seeded generation/dock/account invariants, benchmark recipe sentinels, asset paths and source/bundle parity. `git diff --check` passes. The static `dist/` deployment has no transpile step. No browser or full worker/WebGL test was run for 1.1; no current normal gameplay path reads the opening settings. The README's named suites remain absent.

The fixed world and simulation benchmark code and startup recipes are unchanged. Configuration validation and source generation were the changed subsystem; there is no generation or frame-speed claim. A fresh browser simulation comparison is unnecessary for this source-only subphase. Phase 1 is **not complete** until 1.2 routes these settings, isolates benchmarks explicitly, passes its checks and the whole Phase 1 PR merges into `economic-improvement`.
