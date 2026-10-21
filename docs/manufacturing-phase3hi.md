# Manufacturing investment and inspection: Phases 3H–3I

The active worker uses `BridgeLogistics`, `EconomicEngine`, `FundedMarket` and `IndustryConstructionEngine`. All five secondary types share procurement, production, cost attribution and owner-attributed offers. The port screen now exposes each instance's account, buffers, orders, inbound goods, production progress and blockers, output capacity, costs, floors, actual revenue recipients, recent batches, construction and investment evidence. Worker snapshots are detached and inspection performs no writes.

## Investment lifecycle

| Step | Authoritative behavior |
| --- | --- |
| Visiting evidence | At authoritative docking, copy carried LOCAL_MARKET observations before merging the host market. Retain observation time, original port, carrying ship, visit and revision. Initial charts, stale reports and repeated copies cannot establish persistence. |
| Review | Read the receiving port's live market and copied remote reports only. Require repeated persistent shortages, sufficient profitable bid depth, input coverage and a suitable construction site. Estimates remain speculative. |
| Protect funds | Spendable balance already excludes all commitments. Protect the greater of the minimum town reserve and consumption-per-day × buffer days × local reference price. Require an additional surplus after material bid budgets and working capital. Reserve arithmetic and commitments use exact integer microgold. |
| Accept investment | Atomically reserve working capital, allocate available port-owned materials, issue funded orders for missing materials and clear compatible local offers. Third-party inputs pay their identified owners. No construction gold fee or grant. |
| Receive materials | Accepted imports remain buyer-owned aboard the ship until timed unloading reaches the protected construction store. Town consumption cannot count construction materials or its inbound deliveries. |
| Build | When materials are physically present and the current town reserve is protected, reserve them for construction. Preserve the accepted port/type identity. Use existing terrain, site and isolated-road rules. Failed placement retains materials and capital for a subsequent review. |
| Complete | Consume reserved materials once, create the individual factory and transfer its committed working capital from the port. Start shared procurement and production. Duplicate callbacks are safe. |

Projects and acquiring stages count toward port/type limits. The same observed opportunity cannot repeatedly create factories without a newer observation. Pending orders are finite and funded. Accepted acquisitions can wait for supply indefinitely; there is no automatic replenishment, remote reservation, cancellation or shortcut around maritime handling. Actor removal is blocked while accepted obligations remain unresolved. A full restart starts a new accounting session.

## Balancing controls

The developer panel includes Manufacturing balance, with quantities in cargo units, durations in simulation seconds, capital in gold and price/cost weights in ratios. Each type has independent recipes, buffers, capacities, construction inputs/time/capital, deterministic input priority, procurement bid limits/review interval and output pricing controls. Validation rejects invalid or inconsistent recipes and capacities, unknown commodities, duplicate types and unsafe monetary values. Invalid edits show an error and are not staged.

Validated edits are staged for a **full simulation restart** of the current world. They do not mutate the running worker, existing batch terms, paid transfers or incurred costs. Regenerating the world restores its catalog definitions. Current snapshots report active definitions, rather than staged settings. Existing factory identities and graphics cannot be changed through these controls.

Investment settings also apply on full restart. Their developer controls explain units and effects. Defaults are provisional tuning:

| Policy | Default |
| --- | --- |
| Review interval / report maximum age | 30 / 600 simulation seconds |
| Shortage persistence / distinct observations | 120 seconds / 2 |
| Minimum shortage and profitable depth | 4 cargo units |
| Reserve buffer / minimum reserve | 0.001 simulation days / 250.00 gold |
| Additional surplus | 500.00 gold |
| Pending projects / total factories / instances per type | 1 / 3 / 1 |
| Minimum observed input-buffer coverage | 25% |
| Expected minimum margin | 10% |
| Construction material maximum bid | Commodity baseline × 2 |
| Copied reports per port / investment events | 64 / 128 |
| Review priority | Distillery, textile mill, ironworks, cannon foundry, cannonball foundry |

Money is stored in integer microgold and displayed using the shared formatter with exactly two decimals. Manufacturing floors account for the share taken from total sale revenue; integer split remainders remain with the factory. Unaccepted offers can change; factual fills and costs cannot. Financial, production, transfer and economic histories retain their existing bounds. Live account/ownership records remain while needed for obligations.

## Verification and conservation

Focused suites cover investment funding and reserve protection, stale and duplicate observations, remote-read exclusion, third-party material payment, pending physical delivery, failed multi-payment rollback, placement retry, identity protection, bounded/detached history, validated type-isolated tuning and restart application. Existing suites cover competing procurement, empty accounts, full output storage, fractional production, exact cost allocation, duplicate production callbacks, construction rollback, whole-unit handling, funded settlement, inspection and worker compatibility.

The integrated scenario runs all five chains plus a second independently owned textile mill, material-only construction, actual capital transfers, local procurement, ironworks-to-foundry inputs, merchant loading/sailing, sea purses, docking settlement, immediate delivery acceptance and timed unloading with an empty wallet. It also includes primary production and town consumption. Opening and closing totals are both **21,123,000,000 microgold (21,123.00 gold)**. One **100.00-gold** ironworks input-order commitment remains within its account balance; no physical transfers remain. All goods sources and sinks reconcile within the documented float64 representation tolerance; gold equality is exact.

Run `node scripts/secondary-industry-report.mjs` to reproduce the detailed JSON and Markdown report. The fixture uses synthetic geography and short configurable durations for reproducibility. Automated worker/DOM checks verify the UI data and interactions; visual browser verification was unavailable in this environment.

## Remaining boundaries

Forestry is absent from the supplier catalog and is explicitly surfaced for wood-dependent factories. No new food/spice supplier chains are introduced here. Observed remote supply is an estimate, never guaranteed liquidity. The governor may legitimately wait for evidence, capital, physical materials or terrain. Shipyards and vessel construction remain a later phase; their planned inputs are wood, iron bars, cannons, cannonballs and textiles, with irrevocable vessel orders. No unexplained money path is added by this increment.
