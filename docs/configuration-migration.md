# Phase 1C: compiled subsystem settings and migration

Historical migration report. Phase 1D now implements activation; runtime-configuration.md supersedes the prospective activation statements below.

## Coverage and authority

All 31 Phase 1A definitions now reach their consumers. Twelve audited additions cover economy scarcity/surplus signals and default elasticity, route wind-shift degrees, and industry/road/building detail boundaries. There are 43 definitions: 34 world settings and 9 application settings. The existing developer setup panel exposes these bindings; no player options screen was added. Configuration edits still require a new generated world.

`configuration_definitions.json` is the sole source of migrated defaults; `configuration_overrides.json` supplies developer selections. Complete validated snapshots select the effective values. `compiled-configuration.js` converts snapshots into deeply frozen, fixed-shape clock, economy, merchant, fleet, scaling, road, threat, navigation and rendering objects. Its `.d.ts` defines explicit readonly fields and nested quota records. Neither compilation nor reconstruction changes caller input.

The numeric values formerly duplicated in `settings.json` have been removed; that catalog now holds only its legacy ID marker. `systemSettings`, `SIMULATION_SETTINGS`, the default wage constant and the old developer compilation helper are compatibility views of compiled values, not independent default catalogs. No migrated production consumer reads the marker file for tuning.

Precedence:

1. Validated world/application snapshot values govern migrated global settings.
2. Entity registries retain ship polars, crew and hull costs, commodity base prices/spoilage, recipe quantities, settlement stock/tax/growth profiles, faction metadata and dock/building costs.
3. Explicit market elasticity on a stockpile overrides the central fallback elasticity. Global crew wage applies to each ship's entity hull maintenance and actual crew count; its entity-derived default maintenance annotation is compiled per engine revision.
4. Existing low-level constructor parameters remain for tests/embedding, including the unit-agnostic EconomicEngine default of one tick per accounting day. Production adapters supply compiled world values explicitly. These parameters are not an alternate player configuration or live-change API.

The legacy LogisticsEngine prototype still has distinct standalone wallet/distance defaults (10,000 / 0.1). The active merchant-session adapter has always overridden them with the game defaults (20,000 / 0.03); it now obtains those values from compilation. Normalizing these different standalone defaults would change unrelated prototype behavior, so it was deliberately not done.

## Migration order and verification

| Stage | Changes | Checks before next stage |
|---|---|---|
| Global simulation | Single compiled timing source; runtime clock and worker timer use the world physics/economic intervals; legacy global aliases derive from it | Foundation, constraints, Phase 0/1, startup |
| Economy and overhead | Port accounting day, wages, scarcity/surplus defaults, market elasticity fallback; preserve entity overrides | Economy, supplies, Phase 0, bridge, purchase lock |
| Cargo, policy and spawning | Cargo service, starting wallet, minimum profit, distance cost, merchant cap, faction patrol quotas; main-thread density respects the world cap | Traffic, bridge, developer workflow, fleet, capital docking, docking |
| Ledger/procurement/infrastructure | Map-scaled ledger lifetime, shortages, order review, queue review and deadlines; configured road radius/terrain/search bounds reach generation and expansion; cache per-port scaled infrastructure intervals | Feeder roads, industries, colony presets, urban expansion, Phase 2A/2BC, traffic |
| Threat/navigation | Threat cap/decay/EMA windows, once-compiled retention, route persistence/threshold and degree-to-radian conversion; revision-tagged route work | Sailing/tacking, navigation safety/traffic, patrol threat, bridge, optimization |
| Rendering | Icon size and fades, road visibility/detail and building detail fades; positive ranges validated by the rendering owner | Icons, road geometry/LOD, port visibility, dock renderer, developer workflow, startup |

Defaults remain numerically identical. The fixed `1/sqrt(3)` ledger speed normalizer remains code as a hex/world-unit calibration; the operational standard ship speed is independently configurable. Seconds remain the universal bridge clock. Profile fields historically called `*_ticks` remain in their existing seconds-based use; per-economic-tick production/consumption quantities are unchanged.

## Thread contract

The main thread resolves a complete world snapshot before requesting generation. The generator requires and reconstructs it before generating infrastructure. On return, the main thread reconstructs the same frozen envelope for preview economy and presentation adapters. MerchantTraffic transfers that snapshot with the world; the simulation worker rejects missing snapshots, reconstructs its own immutable objects, and initializes economy, logistics and runtime from it. It never chooses independent worker defaults. State packets carry configurationRevision; presentation ignores a packet from a different known revision.

Standalone headless worlds can still use the compiled default snapshot through their adapter. At the main-thread worker boundary this is resolved explicitly and attached before sending. Pure compiler caching only accepts deeply frozen snapshot envelopes; mutable transferred inputs are reconstructed without assuming identity means unchanged values.

No resolver searches occur in steering, ship integration, cargo service, upkeep, threat ticks or detail blending. Per-tick consumers access numeric fields directly. Derived accounting ticks, patrol retention, radians, fade spans and map/profile timing objects are built before these loops. Dynamic quantities such as current crew cost, commodity spoilage and actual docking demand remain ordinary state calculations.

## Revision tags and Phase 1D invalidation

| Dependency change | Required action before activation |
|---|---|
| Clock intervals / accounting day | Coordinate runtime accumulators, worker callback interval and economic daily counter. Define treatment of partially elapsed days and pending costs; never change one clock mid-tick. |
| Wage / merchant policy / cargo service | Recompile owner objects and default role maintenance; cancel/reprice queued planning work and voyage profitability estimates. Preserve already locked purchase quotes. Define how active cargo service handles a new rate. |
| Fleet limits / quotas | Reconcile through the fleet owner at a boundary; define safe retirement and cargo/berth handling before reducing fleets. No automatic live reconciliation added. |
| Ledger lifetime / map scaling | Rebuild port/ship/player ledger policies, shortage forecasts, queue review timers and contract expectations. Decide whether existing contracts retain their original deadlines. |
| Road generation / terrain rules | New-world settings require regeneration, not a live replacement of roads. Rebuild feeder reachability and expansion eligibility with the regenerated topology. |
| Threat / navigation | Rebuild threat policy and clear metric/risk/bounds caches; reset route monitors, cancel jobs with an old configurationRevision and replan affected routes. Geometry-only terrain caches need invalidation only when topology/clearance dependencies change. |
| Rendering thresholds | Swap the application rendering object at a frame boundary; reset cached views and refresh alpha/size. Geometry and source asset textures do not depend on these thresholds. |

Compiled groups and owner instances carry revision. Map scaling, infrastructure review records, expansion eligibility, threat grids, route monitors, tactical navigators, route records and planning jobs are tagged. Legacy voyage-path cache keys include revision. Stale queued jobs are guarded by revision as well as their existing nonce. No activation coordinator, live registry mutation or replay/save/network layer was introduced.

Phase 1D should accept Phase 1B successful candidate batches, compile both scopes off to the side, prepare owner replacement objects, then atomically commit a complete revision at each declared boundary. Preserve the old active snapshot on validation or preparation failure. Restart/new-world settings must follow their existing lifecycle. Add boundary tests proving that every subsystem sees one revision during an entire tick/frame, and test cache/job disposal and locked-quote preservation.

## Deliberately remaining values

These are recorded rather than silently rebalanced or promoted to unsafe configuration:

- Market price floor/ceiling factors and extreme-stock boundary multiplier (0.1 / 10), minimum availability epsilon and logarithmic overflow guards need an economic semantic audit before making them configurable.
- Wall-clock worker callback budget (24 ms), route-planning budget (4 ms), task-yield quotas, scheduler publish intervals and requested-speed control (1–20) need a determinism/throughput policy. Existing wind/density test controls remain environmental inputs, not new configuration activation.
- Navigation probe fans, turn/recovery safety distances, wind/calm tolerances, tacking geometry, clearance penalties, risk cost multiplier, cache capacities and native integration substeps require owner safety validation. Physics, conservation, epsilon checks, hex vectors/rounding and bitmasks remain algorithms.
- Threat ring weights, frequency saturation, impulse and scale are existing algorithm parameters not yet cataloged. No threat rebalance was performed.
- Default six test merchants, legacy scan interval and experimental trickle/range/agent-value parameters remain adapter/prototype policies pending review. The configured merchant ceiling is enforced for the actual test fleet.
- Settlement tax, initial treasury/upkeep, stock multipliers, growth weights/capacity, review/cooldown rules and maximum docks remain entity/profile data. Their map-scaled derived intervals are compiled by their owner at initialization.
- Locked pennant size 3, perspective sprite anchors, art inset/span, texture filtering parameters, port labeling thresholds and RenderBudget hysteresis remain presentation/art policies pending separate auditing. Road/building/industry detail fades are migrated.

No unrelated economic, docking or fleet defects were fixed. No browser FPS claim is made; verification uses headless regressions and controlled CPU measurements.

## Behavioral and performance results

The full baseline suite had 62 passing and 3 failing tests. The migrated suite has 63 passing and the same 3 failures, including the new compiled-configuration coverage. Later clock-boundary refinements passed all affected configuration, worker, startup and Phase 0 regressions. Catalog schemas, references, asset checks and whitespace validation passed.

Existing failures were left untouched:

- anchoring.test.mjs:37: military requestDock returned false where the assertion expects true.
- logistics.test.mjs:40: actor remained IN_TRANSIT where the assertion expects RECOVERING.
- military-traffic.test.mjs:16: ENGLAND WAR_GALLEON quota was zero where two are expected.

The new tests exercise custom values in generation, accounting, wages, cargo, fleet limits, map-scaled timing, threat and rendering; immutable compilation/transfer; worker refusal of missing snapshots; revision metadata; and rejection of a conflicting runtime clock for an already configured session. Registry entrypoints are replaced with throwing stubs while integration, economic ticks, steering, upkeep, threat ticks and rendering run, confirming no hot-loop configuration resolution.

Six paired benchmark trials used the same Node version, seed, 128-hex map, wind, workloads and physics step. Trial order was counterbalanced, without the test suite running concurrently. Each hull sample performs 100,000 native steps; each fleet sample performs 300 updates, with a fixed quota of 20 generator resumes to remove wall-clock scheduling differences. The 30-merchant fleet also has 3 patrols; the 100-merchant fleet has 24. Source, complete method and raw samples are in scripts/configuration-benchmark.mjs and docs/configuration-benchmark-results.json.

All six trials matched exact fingerprints for generated terrain/ports/industries, the economic scenario, hull motion and both fleet end states. Tests retain the existing ship physics and docking assertions; no unrelated algorithm was changed.

| Headless measure | Before (ms) | After (ms) | Change |
|---|---:|---:|---:|
| 100,000 hull steps | 98.387 | 104.933 | +6.65% |
| 30 merchants, tick p50 | 0.887 | 0.895 | +0.89% |
| 30 merchants, tick p95 | 7.193 | 7.232 | +0.54% |
| 30 merchants, total 300 updates | 693.147 | 695.187 | +0.29% |
| 100 merchants, tick p50 | 5.331 | 5.337 | +0.10% |
| 100 merchants, tick p95 | 9.230 | 8.958 | -2.95% |
| 100 merchants, total 300 updates | 1441.105 | 1411.491 | -2.05% |

Fleet measurements are within approximately 3% of baseline. The isolated hull benchmark measures 6.65% slower after counterbalancing. Physics source is identical after removing browser cache-version tokens, and no configuration searches occur in that loop. The cause of this microbenchmark difference was not established; retain it as a profiling follow-up rather than claiming identical performance or browser frame rates. These short headless scenarios do not certify long-running 20x simulation throughput, browser graphics performance or every proposed configuration range.
