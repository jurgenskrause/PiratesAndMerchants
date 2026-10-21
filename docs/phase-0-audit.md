# Phase 0: economy foundations

Audit and implementation completed against published source `9c1454b7391e6b65a80a1e06f99b316f797d6d52`. Older workspace changes were preserved in a Git stash; their fleet-distribution changes were already present in the published source. The docking recovery and pier-end mooring fixes remain in place.

## Audit and boundaries

| Previous coupling | Implemented boundary |
|---|---|
| Nine commodity IDs in `economy.js`, prices in `port-supplies.js`, spoilage in `bridge-rules.js` | `simulation-registry.js` owns commodity definitions. Engines accept an injected registry and enumerate its IDs dynamically. The historical `COMMODITIES` export remains a compatibility snapshot. |
| Industry-to-commodity mapping and output values in economy setup | Industry registry supplies commodity and output definitions. Generated visual industry types remain a renderer/map concern. |
| Vessel class maps and fixed maintenance arrays in shipping modules | Vessel registry supplies class IDs, physical-type references, role flags, hull maintenance, default crew and crew capacity. Geometry and sail-frame metadata remain in `fleet.js`. |
| Static constructor-only inventory shape | `EconomicEngine.registerPort` and `addStockpile` provide validated additions. Stockpiles are still authoritative engine-owned quantities, not freely mutable objects. |
| Market reads scattered through shipping and UI | `MarketModel` is a read-only event projection. Active merchant planning uses its own `PriceLedger`; authoritative reads remain at the docked purchase/transaction boundary. Legacy `LogisticsEngine` uses the projection but retains its historical global opportunity-scoring semantics; it is not the active test-mode planner. |
| Local market refresh driven only by docking/polling | Transactions, transfers, allocations, reservations, cancellations, modifier changes and production ticks publish `MARKET_CHANGED` deltas. Local port reports update from these events. Remote ship reports update only through docking and physical ledger propagation. |
| Scheduling and economy sequencing embedded in the worker | `SimulationRuntime.step` owns the headless clock and production-before-shipping order. Worker code owns scheduling, messages, speed budgets and snapshot presentation. |
| Hardcoded Pixi load URLs | Asset registry contains logical IDs and URLs. Injected loader coalesces concurrent requests, loads ships lazily and retries failed loads. No renderer objects enter simulation registries. |

Failed transactions emit no market changes. Event payloads are immutable copies, revisioned and port-specific. Listener failures are isolated from settled transactions, and projection subscriptions can be disposed. Same-tick price changes merge by revision after timestamp comparison, preventing stale docking reports from winning a tie.

## Distance and clock conventions

All duration and ledger ticks in the bridge are simulated seconds. Production rates remain per economic tick, currently ten seconds. A simulated day is 86,400 seconds. Requested simulation speed changes the number of fixed steps, never the physics timestep.

Port generation calculates connected water components once, then computes the mean **hex-step distance** over ordered connected port pairs. If every port is connected, the denominator is exactly `N * (N - 1)`. Disconnected pairs are excluded from numerator and denominator; this is water connectivity, not diplomacy or a vessel-specific draft route. The metric is not an expensive all-pairs pathfinding result. Empty, single-port or entirely disconnected maps report zero measured distance and use the reference distance for timing, avoiding division by zero.

`simulation-settings.js` holds named tuning defaults:

- Reference distance: 50 hex steps; map scale factor: 1.
- Standard speed: `1 / sqrt(3)` hex steps per simulated second, corresponding approximately to one world unit per second.
- Base procurement urgency: 300 ticks; base ledger age: 1,800 ticks.
- Base queue review: 15 ticks; base job review: 5 ticks.
- Contract safety margin: 3.

Procurement urgency is `BaseUrgencyTicks * (D_avg / ReferenceDistance) * MapScaleFactor`, rounded upward to whole ticks. Queue and job review intervals use the same distance multiplier. Intelligence lifetime additionally scales inversely with standard ship speed. Contract deadline estimates use `CurrentTick + ceil(HexDistance(A,B) / StandardShipSpeed * SafetyMarginFactor)`.

Governor records now expose commodity coverage and urgent shortage assessments against the map-scaled horizon. Coverage converts economic-tick consumption into seconds and subtracts production directed into consumption reserves. No net consumption means infinite coverage. This does not create a governor procurement AI or automatically move stock.

Trade and patrol orders carry created/deadline ticks. These are duration expectations; deadline enforcement, penalties and a full contract lifecycle belong to later phases. Low-level rudder control, collision probes, wind hysteresis and interpolation timings remain physical tuning rather than map-size multipliers.

## Unified overhead

The global wage is `GLOBAL_DAILY_WAGE_PER_CREW = 0.1` gold per crew member per day. All runtime ship overhead, anchored upkeep, waiting-cost estimates and maintenance portions of route estimates use:

`BaseHullMaintenance + CurrentCrewCount * GLOBAL_DAILY_WAGE_PER_CREW`

| Vessel | Base hull/day | Default crew | Full default overhead/day |
|---|---:|---:|---:|
| Sloop | 2 | 12 | 3.2 |
| Schooner | 4 | 24 | 6.4 |
| Brigantine | 6 | 40 | 10 |
| Fluyt | 10 | 60 | 16 |
| Frigate | 18 | 120 | 30 |
| War galleon | 25 | 180 | 43 |
| First rate | 40 | 300 | 70 |

These are explicit arcade tuning defaults, not historical crew research. Crew counts can change through validated setters, including zero crew; zero crew still incurs hull maintenance. Actual payments remain capped by the current wallet. Insolvency/arrears policy is deferred. The old `dailyMaintenance` role field is a derived compatibility value for default crew, not the runtime source for charges. Route risk and abstract distance estimates remain distinct from daily operating overhead.

## Scope preserved and remaining work

This phase does not add manufacturing recipes, population growth, autonomous governor purchasing, budget-conserving market counterparties, contract enforcement or persistent saves. Seeded port inventories remain test fixtures, now assembled from registries. Registered market ports receive event updates immediately; dynamically adding them to shipping routes and faction assignments remains an explicit orchestration operation. The existing traffic port-selection limit is unchanged.

The removed governor panel module remains dormant compatibility UI. Its commodity options read supplied stock data. The public Layer 1 scarcity/reservation event contract remains unchanged alongside the new market stream.

## Verification

`tests/phase0.test.mjs` checks connected/disconnected hex means, scale and speed formulas, no-port fallback, custom commodities, dynamic port and inventory additions, immutable market events, failed-operation behavior, same-tick ledger revisions, no remote knowledge leakage, disposal, observer failures, crew-dependent charges, coverage conversion, headless tick order, asset request coalescing and retry.

Existing accounting, protected-stock, physical voyage, merchant agency, full-fleet, generated-map and docking tests are run to verify integration. Browser FPS is not inferred from headless timings.

Integration verification passed: foundation/Layer 1/Layer 2/supplies/ledger tests, generated physical merchant voyages, worker/Pixi integration, 100 merchants plus 32 military vessels, generated ports through 512², and 684 heavy-ship coastal docking/departure pairs. A standalone full-fleet headless run measured tick p50 13.96 ms and p95 27.44 ms. These are CPU simulation timings, not browser FPS or a claim of guaranteed 20× acceleration.
