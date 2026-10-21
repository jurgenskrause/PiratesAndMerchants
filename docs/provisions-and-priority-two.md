# Provisioning and Priority 2

All BridgeLogistics ships have independent water stores and morale (0–100, initially 100). Morale is data only; zero water does not change sailing physics or minimum steerability yet.

Water uses crew-seconds, separate from cargo. Capacity is default crew × the generated map's expected transit seconds × class `water_endurance_voyages` (0.9 for sloops, 1.0 schooners, 1.05 brigantines, 1.15 fluyts/frigates, 1.25 war galleons, 1.35 first-rates). Actual crew consumes one unit per second away from a friendly harbor. This is an arcade endurance counter, not a litres/bathymetry simulation. Stores below 25% force a safe-route search for a friendly port. A long route is one projected to finish below the 25% reserve, using the remaining route and vessel polar efficiency under the current wind. Captains can stop early when below 90% and passing a convenient forward friendly port (six-hex search radius), or below half full when projected reserves are insufficient. Proactive stops must advance the route and avoid disproportionate detours. Emergency stops retain nearest-safe-port selection, but a completed replenishment port cannot be repeated for the same destination within the same voyage; later voyages may reuse it. No reachable friendly anchorage means continuing and retrying after ten seconds, without teleportation or a movement penalty.

Stops choose the fastest wind-adjusted reachable anchorage among eligible friendly accessible ports. Search uses the same hull-aware navigator. Berth compatibility is not required to take water at anchor. The ship joins the harbor's safe anchorage allocation, replenishes over 60 seconds from empty, and exchanges ledgers on arrival/at one-second intervals. Normal anchored ships also refresh knowledge. No berth or cargo transaction occurs at a water stop.

The incoming order, hold, purchase quote and voyage journal survive the interruption. Stop arrival/departure and subsequent destination are recorded in that voyage. After replenishment, merchants compare known net sale proceeds less remaining sailing/upkeep/risk/spoilage costs; purchase costs are sunk. An alternative must improve the original destination's remaining result by more than max(minimum profit, 10% of its magnitude). Unknown/expired reports cannot invent profitable alternatives. Accepted `contract`, `deliveryCommitment` or `lockedDelivery` markers prevent speculative redirection; no contract system has been introduced. Military vessels retain their original patrol destination. A stop never completes a voyage.

The inspector shows five outlined blue drops with 0–5 filled according to the supply fraction, a precise percentage, water-stop status and morale. Automated ship snapshots/debug reports carry provisions. The separately controlled player vessel remains outside ShipAgent provisioning and forced AI diversions.

`provisions.refill_seconds` and `provisions.diversion_improvement` are central restart-only settings. Endurance stays in the vessel registry. Compiled settings expose direct numeric fields, with no hot-loop registry lookups.

## Optimization ownership

- Route length, travel duration, baseline cost and threat exposure are calculated once per actual planning candidate and reused for all commodity quotes and ranking. The preflight uses a single empty-route statistic set.
- Hidden purchase commitments and destination-crowding scans are removed, rather than indexed. Merchants cannot inspect fleet intentions. Existing real port stock reservations remain represented in known `available` stock; actual purchasing still competes against live stock.
- Traffic positions use a shared spatial index per bridge update. Search bounds include both vessels' speed/velocity, the entire prediction horizon and hull clearance. Sparse/large-radius queries fall back to occupied buckets. Original fleet order and closest-approach/give-way scoring are preserved.
- Harbor indexes cover port/dock reservations, occupied water cells, anchor cells, busy departure/approach lanes and FIFO queue positions. Mutation commands invalidate derived indexes; reads never advance reservations. Geometric hull/anchor clearance still checks relevant reservations, and rebuilding indexes is linear at mutation boundaries.
- Four explicit ordered planning queues separate civilian/military and queued/running jobs. Selection preserves role alternation, ongoing-job preference and insertion order without array search/splice. Developer/test inspection retains iteration, indexing, find, every and FIFO shift compatibility.
- Runtime configuration preparation reconstructs planning queues and restarts water/turnaround jobs through explicit intents. Stale tasks cannot clear a newer task's planning flag.

## Verification

New provisioning tests cover crew consumption, the below-25% trigger, nearest reachable stop, native sailing/anchor arrival, finite refill, local ledger contact, conserved hold/journal/order, sunk-cost destination redirection, delivery commitment preservation and absence of hidden purchase-intention knowledge.

Scheduler differential testing matches 2,000 legacy selections. Spatial queries match full-fleet steering for 200 diverse ships, including large hulls and high inbound speeds. Existing harbor exclusivity, queue, generation, voyage, observation-frequency, runtime configuration and fleet soak regressions are retained.

Performance is checked using identical seeded worlds and fixed planning iterations against commit 65af12afdc1a452496eaa63fb1ba37c6ce192024, in counterbalanced standalone runs. Results are headless CPU timings, not browser FPS. Fleet outcomes can change intentionally because merchants no longer have hidden competition knowledge and acquire information at anchor.

Measured counterbalanced fleet results (two runs per version; milliseconds per 1/30-second update):

| Fleet | Before p50 / p95 | After p50 / p95 | Before / after total CPU for 300 updates |
|---|---:|---:|---:|
| 30 merchants + 4 patrols | 0.749 / 7.514 | 0.744 / 7.679 | 669.900 / 693.840 |
| 100 merchants + 32 patrols | 5.694 / 11.328 | 5.751 / 11.208 | 1628.070 / 1635.856 |

Overall performance is approximately unchanged; no aggregate FPS/speedup claim is justified. Focused seven-sample median benchmarks with identical calculations measured route-stat reuse at 0.484 ms versus 9.836 ms for repeated evaluation (500 candidates × 20 commodity evaluations), and 500-vessel traffic queries at 2.277 ms versus 21.299 ms for full scans. These synthetic workloads demonstrate the optimized operations, not the cost distribution of the ordinary game. Run `node scripts/priority-two-benchmark.mjs` and `node scripts/runtime-configuration-benchmark.mjs` to reproduce.

Native sailing regression `water-endurance` verifies short A–B legs with no water stop and longer A–C legs with exactly one intermediate B stop on both 128- and 256-size layouts. It checks native steering, safe poses, finite refill time, one continuous voyage, no repeated replenishment loop, and higher projected consumption when tacking. The tuning deliberately changes voyage schedules; prior Priority 2 performance figures above describe the earlier endurance settings, not this later balance change.
