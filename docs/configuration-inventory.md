# Configuration migration inventory

Phase 1C migrates all 31 initial definitions below. Original source locations are retained for audit history; their current defaults are authoritative only in configuration_definitions.json. Bounds remain developer ranges, not certification of every generated world. See configuration-migration.md for precedence and remaining values.

| Proposed ID | Existing default | Range / step | Source | Scope / application |
|---|---:|---|---|---|
| `economy.daily_wage_per_crew` | 0.1 | 0–100 / 0.1 | `dist/data/settings.json:globalDailyWagePerCrew` | world / simulation_restart |
| `simulation.seconds_per_day` | 86400 | 60–864000 / 1 | `dist/data/settings.json:secondsPerDay` | world / simulation_restart |
| `simulation.economic_tick_seconds` | 10 | 1–60 / 1 | `dist/data/settings.json:economicTickSeconds` | world / simulation_restart |
| `simulation.physics_tick_seconds` | 0.03333333333333333 | 0.008333333333333333–0.06666666666666667 / 0.008333333333333333 | `dist/data/settings.json:physicsTickSeconds` | world / simulation_restart |
| `procurement.base_urgency_seconds` | 300 | 1–100000 / 1 | `dist/data/settings.json:baseUrgencyTicks` | world / simulation_restart |
| `scaling.reference_distance` | 50 | 1–1000 / 1 | `dist/data/settings.json:referenceDistance` | world / simulation_restart |
| `scaling.map_factor` | 1 | 0.1–10 / 0.1 | `dist/data/settings.json:mapScaleFactor` | world / simulation_restart |
| `scaling.standard_ship_speed` | 0.5773502691896258 | 0.07735026918962584–10 / 1e-05 | `dist/data/settings.json:standardShipSpeed` | world / simulation_restart |
| `scaling.safety_margin` | 3 | 1–10 / 0.1 | `dist/data/settings.json:safetyMarginFactor` | world / simulation_restart |
| `ledger.base_max_age_seconds` | 1800 | 1–100000 / 1 | `dist/data/settings.json:baseLedgerAgeTicks` | world / simulation_restart |
| `logistics.base_queue_review_seconds` | 15 | 1–10000 / 1 | `dist/data/settings.json:baseQueueReviewTicks` | world / simulation_restart |
| `merchant.base_job_review_seconds` | 5 | 1–10000 / 1 | `dist/data/settings.json:baseJobReviewTicks` | world / simulation_restart |
| `roads.feeder_radius` | 18 | 1–100 / 1 | `dist/data/settings.json:feederRoadRadius` | world / new_world |
| `roads.mountain_height` | 0.78 | 0–1 / 0.01 | `dist/data/settings.json:roadMountainHeight` | world / new_world |
| `roads.max_search_nodes` | 4096 | 64–100000 / 1 | `dist/data/settings.json:roadMaxSearchNodes` | world / new_world |
| `logistics.cargo_handling_rate` | 10 | 1–1000 / 1 | `dist/bridge-logistics.js:tick` | world / next_tick |
| `merchant.minimum_profit` | 1 | 0–10000 / 1 | `dist/bridge-logistics.js:constructor` | world / next_tick |
| `merchant.starting_wallet` | 20000 | 0–1000000 / 100 | `dist/bridge-logistics.js:defaults` | world / simulation_restart |
| `merchant.distance_cost` | 0.03 | 0–10 / 0.01 | `dist/bridge-logistics.js:journey` | world / next_tick |
| `fleet.max_test_merchants` | 100 | 0–1000 / 1 | `dist/merchant-session.js:MAX_TEST_MERCHANTS` | world / simulation_restart |
| `navigation.wind_persistence` | 5 | 0–60 / 1 | `dist/bridge-logistics.js:constructor` | world / next_tick |
| `navigation.threat_threshold` | 50 | 0–100 / 1 | `dist/bridge-logistics.js:constructor` | world / next_tick |
| `threat.max_threat` | 100 | 1–1000 / 1 | `dist/threat-grid.js:constructor` | world / simulation_restart |
| `threat.decay_rate` | 2 | 0–100 / 1 | `dist/threat-grid.js:constructor` | world / simulation_restart |
| `threat.frequency_half_life` | 120 | 1–10000 / 1 | `dist/threat-grid.js:constructor` | world / simulation_restart |
| `threat.recency_window` | 30 | 1–1000 / 1 | `dist/threat-grid.js:constructor` | world / simulation_restart |
| `threat.max_patrol_age` | 500 | 1–10000 / 1 | `dist/threat-grid.js:constructor` | world / simulation_restart |
| `fleet.frigate_merchants_per_patrol` | 5 | 1–100 / 1 | `dist/merchant-session.js:PATROL_QUOTAS` | world / simulation_restart |
| `fleet.war_galleon_merchants_per_patrol` | 10 | 1–100 / 1 | `dist/merchant-session.js:PATROL_QUOTAS` | world / simulation_restart |
| `fleet.first_rate_merchants_per_patrol` | 15 | 1–100 / 1 | `dist/merchant-session.js:PATROL_QUOTAS` | world / simulation_restart |
| `rendering.industry_icon_pixels` | 22 | 12–48 / 1 | `dist/industry-icons.js` | application / next_frame |

## Additional migration candidates

| Proposed ID/group | Existing value | Source | Proposed range | Scope / application | Investigation |
|---|---|---|---|---|---|
| `simulation.requested_speed` | 1, UI limit 20 | `dist/merchant.worker.js` | 1–20, integer | world/session / next_tick | Scheduler control rather than persistent economic rule; classify in 1B |
| `scheduler.callback_budget_ms` | 24 | `dist/merchant.worker.js` | 1–50 | application / restart | Must not change simulation outcomes; determinism audit needed |
| `scheduler.planning_budget_ms` | 4 | `dist/bridge-logistics.js` | 1–20 | world / restart | Wall-clock planning completion can alter agent dispatch timing |
| `economy.tax_rate` | 0.08 | `dist/data/settlements.json` | 0–0.35 | world / restart | Keep settlement-specific rate in its registry; central default only if needed |
| `economy.elasticity` | 1.2 | `dist/economy.js:createStockpile` | 0.1–5 | world / restart | Per-market profiles planned later |
| `economy.price_floor_factor`, `price_ceiling_factor` | 0.1, 10 | `dist/economy.js:calculatePrice` | proposed 0.01–1, 1–100 | world / restart | Bounds versus explicit stock boundary behavior |
| `economy.scarcity_ratio`, `surplus_ratio` | 0.1, 2 | `dist/economy.js:constructor` | 0–0.99, 1.01–10 | world / restart | Preserve signal semantics |
| `port.initial_*`, `port.consumption_rate` | 75 reserves, 150 target, 500 specialty, 30–60 ordinary, 0.1 consumption | `dist/data/settlements.json`, `dist/port-supplies.js` | amounts 0–100000; targets positive; rates 0–100 | world / new_world | Entity/profile values should remain settlement data |
| `economy.initial_faction_gold`, `base_faction_upkeep` | 5000, 10 | `dist/data/settlements.json` | 0–1000000, 0–10000 | world / new_world | Funds belong to factions, not duplicated per port |
| `navigation.wind_shift_degrees` | 10 | `dist/route-sailing.js:ROUTE_WIND_THRESHOLD` | 1–45 | world / restart | Convert degrees once; preserve debounce |
| `rendering.industry_icon_fade_start/end` | 10, 20 | `dist/industry-icons.js:industryIconAlpha` | 1–100 | application / next_frame | Require start < end |
| `rendering.pennant_size` | 3 | pennant renderer/fleet definitions | 1–5 | application / restart | Cosmetic; preserve locked default and faction metadata |
| navigation probe/recovery and route-cache settings | Existing implementation-specific values | `dist/navigation-safety.js`, `dist/navigation.js`, `dist/route-sailing.js` | not yet approved | world / restart | Audit hull clearance, ray fan and bounded search before exposing |
| dock/urban review, cooldown and queue settings | 15/60/120/180 seconds; max 6 docks; urban review 30 | `dist/data/settlements.json` | intervals 1–10000; dock count 1–20 | world / restart | Keep profile overrides; map-scaled timing constraints |

## Retain as entity definitions

Ship dimensions, polars, class cargo/crew capacity and base hull maintenance; commodity prices; recipe quantities; building costs/capacity; faction visuals/names; dock layout/compatibility; colony layouts and stock multipliers remain in their existing registries. Do not flatten these into global settings.

## Retain as algorithms

Hex direction vectors, coordinate conversion, mathematical constants, bit flags, transaction atomicity, schema version numbers and conservation checks remain code. Safety guard structure is an algorithm; its tunable distances require domain validation rather than unrestricted options.

## Unresolved range semantics

The baseline standard-ship speed is irrational (1/sqrt(3)). Its provisional step grid is anchored at the existing default minus 0.5 to retain that exact value. A clearer UI representation/unit should be selected before exposing it. Map-dependent, physical safety and population budgets have not been certified across proposed bounds.

## Phase 1C consumer coverage

| Setting ID | Current default | Compiled consumer | Status |
|---|---:|---|---|
| `economy.daily_wage_per_crew` | 0.1 | economy / upkeep | Migrated |
| `simulation.seconds_per_day` | 86400 | clock / port accounting | Migrated |
| `simulation.economic_tick_seconds` | 10 | clock / port accounting | Migrated |
| `simulation.physics_tick_seconds` | 0.03333333333333333 | clock / port accounting | Migrated |
| `procurement.base_urgency_seconds` | 300 | scaling / governor coverage | Migrated |
| `scaling.reference_distance` | 50 | scaling / deadlines | Migrated |
| `scaling.map_factor` | 1 | scaling / deadlines | Migrated |
| `scaling.standard_ship_speed` | 0.5773502691896258 | scaling / deadlines | Migrated |
| `scaling.safety_margin` | 3 | scaling / deadlines | Migrated |
| `ledger.base_max_age_seconds` | 1800 | scaled port, ship and player ledgers | Migrated |
| `logistics.base_queue_review_seconds` | 15 | cargo service / queue review | Migrated |
| `merchant.base_job_review_seconds` | 5 | merchant policy / order review | Migrated |
| `roads.feeder_radius` | 18 | generation / feeder paths / expansion | Migrated |
| `roads.mountain_height` | 0.78 | generation / feeder paths / expansion | Migrated |
| `roads.max_search_nodes` | 4096 | generation / feeder paths / expansion | Migrated |
| `logistics.cargo_handling_rate` | 10 | cargo service / queue review | Migrated |
| `merchant.minimum_profit` | 1 | merchant policy / order review | Migrated |
| `merchant.starting_wallet` | 20000 | merchant policy / order review | Migrated |
| `merchant.distance_cost` | 0.03 | merchant policy / order review | Migrated |
| `fleet.max_test_merchants` | 100 | density / faction quotas | Migrated |
| `navigation.wind_persistence` | 5 | route monitors / hotspot trigger | Migrated |
| `navigation.threat_threshold` | 50 | route monitors / hotspot trigger | Migrated |
| `threat.max_threat` | 100 | threat grid / risk | Migrated |
| `threat.decay_rate` | 2 | threat grid / risk | Migrated |
| `threat.frequency_half_life` | 120 | threat grid / risk | Migrated |
| `threat.recency_window` | 30 | threat grid / risk | Migrated |
| `threat.max_patrol_age` | 500 | threat grid / risk | Migrated |
| `fleet.frigate_merchants_per_patrol` | 5 | density / faction quotas | Migrated |
| `fleet.war_galleon_merchants_per_patrol` | 10 | density / faction quotas | Migrated |
| `fleet.first_rate_merchants_per_patrol` | 15 | density / faction quotas | Migrated |
| `rendering.industry_icon_pixels` | 22 | application icon and town detail | Migrated |
| `economy.scarcity_ratio` | 0.1 | economy / upkeep | Migrated |
| `economy.surplus_ratio` | 2 | economy / upkeep | Migrated |
| `economy.default_elasticity` | 1.2 | economy / upkeep | Migrated |
| `navigation.wind_shift_degrees` | 10 | route monitors / hotspot trigger | Migrated |
| `rendering.industry_icon_fade_start` | 10 | application icon and town detail | Migrated |
| `rendering.industry_icon_fade_end` | 20 | application icon and town detail | Migrated |
| `rendering.road_visibility_start` | 3 | application icon and town detail | Migrated |
| `rendering.road_visibility_end` | 7 | application icon and town detail | Migrated |
| `rendering.road_detail_start` | 12 | application icon and town detail | Migrated |
| `rendering.road_detail_end` | 36 | application icon and town detail | Migrated |
| `rendering.building_detail_start` | 12 | application icon and town detail | Migrated |
| `rendering.building_detail_end` | 30 | application icon and town detail | Migrated |

The additional candidates table above remains an audit backlog. Scarcity/surplus/default elasticity, wind-shift degrees and industry fades are now migrated; the remaining candidates are classified in configuration-migration.md. Maximum test fleet selections still cannot exceed the current supported 100-merchant safety ceiling.

Phase 1D changes the six runtime-safe rows to next_tick. All other world rows retain their restart/regeneration boundaries. See runtime-configuration.md for transaction semantics and cache/job decisions.
