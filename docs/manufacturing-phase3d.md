# Phase 3D: common timed production lifecycle

The active economy now has one configuration-driven production lifecycle. Distilleries are enabled first; textile mills, ironworks and the two foundries remain inactive pending their activation phases. The legacy per-economic-tick converter has been removed.

The catalog distillery recipe is **2 sugar + 0.5 wood → 1.5 rum**, with a provisional **10-second** production duration. Recipes, duration and input/output capacities come from the validated industry definition. There is no distillery-specific economic implementation.

## Batch contract

| Transition | Inputs | Output capacity | Output goods | Money |
| --- | --- | --- | --- | --- |
| Waiting | Only owner-matched, unreserved internal inputs are eligible | Inspect the factory's configured capacity | No output exists for future work | Unchanged |
| Start | Reserve the selected internal quantities as `PRODUCTION:<batch ID>` | Reserve the batch's exact output quantities | No output is created | Unchanged |
| Advance | Inputs remain physically in the input store and unavailable to other uses | The reservation remains in the active batch | No handling-tick output | Unchanged |
| Complete | Consume exactly the reserved quantities, recording manufacturing-input sinks | Replace the logical reservation with physical output | Create instance-owned output, recording manufacturing-output sources | Unchanged |

The engine supports one active batch per instance. Stable batch IDs contain the industry account and a monotonic serial. Repeating an active start returns that batch. Repeating any previously completed batch's completion returns a duplicate result and cannot create another output, even after its detailed history has expired.

When inputs or output space allow only part of a recipe, the engine secures a fractional batch. Its inputs and outputs scale together, while its duration remains the configured duration. This provisional rule preserves fractional production without creating output every handling tick. Merchant pickups remain whole units through the existing funded acceptance and loading path.

## Physical storage and availability

Reserved inputs retain their industry owner, internal-store location, acquisition costs and provenance. They cannot be consumed, moved through unreserved APIs, listed for sale or reserved for another operation. Factory retirement and whole-industry reconfiguration cannot abandon an active batch.

Completed goods are created in the instance's output store and published to its parent market within the same atomic transition. They retain their producer account and manufacturing revenue eligibility. The shared local warehouse holds the listed goods; unsold output remains charged against the producing factory's output capacity. Explicit offers count as stored output too.

Purchased pickups become merchant-owned at acceptance, so that seller's output capacity is released then. The goods remain physically ashore and reserved for that ship until timed loading finishes. They cannot also be offered or consumed. Other owners' stock does not occupy the factory's capacity.

An active batch's reserved output capacity cannot be taken by unrelated allocations into its output warehouse. Completion validates the reserved space before consuming inputs. There is no consignment payment, remote transfer, gold expense or spoilage.

## Timing and waiting

`BridgeLogistics` advances production with elapsed simulation seconds. It progresses existing factories before advancing construction, so a factory completed in that step does not receive production time spent on its construction. Procurement continues to use its separate funded review clock.

Standalone economy ticks use an explicit economic interval, defaulting to the configured clock interval, to exercise this same lifecycle. Once the bridge owns the production clock, economic ticks cannot manufacture a second time. `ticksPerDay`, inspection, render frequency and publication callbacks are not batch-progress sources.

Production states are `NOT_ACTIVATED`, `WAITING_INPUTS`, `PRODUCING` and `WAITING_OUTPUT`. Port inspection shows elapsed/duration, output stock/capacity and the capacity reserved for the active batch. Queries are detached and read-only.

Tiny floating-point residuals below the documented production tolerance remain identified goods rather than becoming endless microscopic batches. The tolerance is eight machine epsilons scaled to the relevant quantities. Waiting states never delete residual goods. Goods quantities remain floating point; money remains exact integer microgold.

Waiting and ordinary in-progress steps avoid full inventory checkpoints. Batch transitions checkpoint the authoritative goods, market and production state; observer publication follows successful commit. Injected start or completion failures restore inputs, capacity commitments, outputs, timing and history together. Observer errors do not roll back completed work or replay it.

## Factual costing and provenance

At acceptance, the batch stores its exact input lots, quantities, acquisition costs, duration, output quantities, capacities, cost weights and definition snapshot. Completion carries the actual consumed acquisition costs into output inventory. Multi-output recipes distribute these costs by validated output weights, leaving the final numeric remainder with the last output.

Output records retain the producing industry, production port, total acquisition cost and aggregated input provenance by input commodity and origin port. Splitting, moving and coalescing goods scales and combines that provenance with their quantities. It is a costing record, not another physical copy of the inputs. A funded resale may record the new owner's purchase cost while preserving original production-input facts.

Detailed completed-batch history is bounded to 256 records. Live batches retain their full facts; goods retain coalesced costing/provenance independently of history expiry. There is no permanent record for every progress tick.

## Live configuration policy

Industry-definition changes remain **simulation-restart only**, as established in Phase 3A. A live recipe, duration, capacity or cost-weight edit is rejected by the shared definition-change contract. It does not amend an active batch or accepted trade. The batch's secured inputs, costs and output promise remain factual until completion.

An entire simulation restart creates a new session and restores its explicit initial state. It is not a refund or transfer within the retiring economy. Ordinary inspection cannot activate new definitions, cancel accepted handling or reprice a batch.

## Verification and conservation

`node tests/industrial-production.test.mjs` exercises constructed distilleries end to end: material-funded construction, working-capital transfers, funded local inputs, fractional and full batches, reserved inputs/outputs, actual costing, whole-unit merchant pickups, capacity release, duplicate completion, fault injection, read-only inspection, observer failures, configuration protection and equivalent time at several step sizes. It also runs the authoritative `SimulationRuntime` and `BridgeLogistics` against a constructed factory.

One controlled two-factory fixture opens with **1,500.00 gold**: 1,000.00 port capital and 500.00 merchant capital. Each factory receives 100.00 transferred working capital and buys 1.25 of input inventory from the port. After two completed batches per factory, balances remain:

| Owner | Gold |
| --- | ---: |
| Port | 802.50 |
| First distillery | 98.75 |
| Second distillery | 98.75 |
| Merchant | 500.00 |
| **Total** | **1,500.00** |

That fixture uses a two-second production duration solely to speed verification. It consumes 80 wood and 20 iron bars for construction, then 8 sugar and 2 wood for production, and creates 6 rum. Its one initial merchant-owned rum remains separate. All reservations change availability without changing physical totals. Production changes no balance or financial commitment.

The Phase 1 and Phase 2 conservation scenarios now include continuous production during voyages, instead of assuming only two conversion ticks. Their manufacturing sources/sinks reconcile against completed batch facts; funded sales, worker shares, paid handling and purse settlement remain covered. Textile conversion in the ownership regression is enabled only in that test's injected definition, not in the active catalog.

Browser visual QA is unavailable in this environment. Graphics work and activation of textile mills/ironworks from the pending Phase 3E request are deferred until after this lifecycle increment.
