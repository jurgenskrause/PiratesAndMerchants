# Phase 3C: shared industrial procurement

Every configured manufacturing industry, including factories completed through Phase 3B, now uses one procurement implementation. The legacy one-batch demand path is replaced by the configured buffer targets. Production for newly constructed factories remains inactive until Phase 3D; the existing legacy conversion executor continues to consume only its own usable inputs.

## Active paths

- `industrial-procurement.js`: shared coverage, exact funded-quantity calculation and waiting-state rules.
- `EconomicEngine`: authoritative factory orders, allocations, local matching, review scheduling and read-only procurement inspection.
- `BridgeLogistics.tick(dt)`: advances procurement using elapsed simulation seconds immediately after construction progression.
- Standalone `EconomicEngine.tick()`: advances the same reviewer once per configured economic interval when a physics clock has not taken ownership. The two demand refreshes inside an economic tick do not advance its clock twice.
- Worker port inspection and the port dashboard: expose each factory's usable inputs, target, paid inbound quantities, unfilled orders and procurement state. Existing market events update merchant ledgers with funded bid depth.

## Quantity and ownership rules

For each configured input:

```text
Required = max(0, target buffer - usable internal stock
                  - paid inbound remaining quantity - other unfilled orders)
Storage space = max(0, input capacity - all physically stored internal stock
                       - paid inbound remaining quantity - other unfilled orders)
Managed order target = min(Required, Storage space)
```

The managed order's existing remaining quantity is replaced by that target, rather than subtracted and then added again. Other orders belonging to the same buyer are counted separately. Goods in a purchased delivery contribute only their remaining quantity aboard; batches that have reached the internal store contribute usable stock instead. A quantity is never counted in both terms.

Usable internal stock requires the exact industry account, its input-store location and no reservation. Reserved internal stock occupies capacity but is not usable. Goods owned by another factory, goods in output storage, construction reservations, explicit selling offers and accepted pickups/deliveries are unavailable for self-allocation.

Already-owned inputs available in the parent market move into the factory's own store without payment, wages or goods creation. Its own automatic offers may be retracted for this purpose; explicit offers remain protected. This allocation works with an empty operating account and preserves origin and acquisition cost.

Goods owned by another actor are acquired through the existing funded local order/offer settlement. It identifies the seller and applies the current revenue rules. Local catchment settlement moves purchased inputs directly to the receiving industry store. Imported inputs remain aboard in their accepted transfer until timed unloading moves each batch ashore. Procurement provides no remote reservation or inter-port transport shortcut.

## Funding, pricing and deterministic priority

The factory's operating account funds its orders. Treasury funds, merchant wallets and ship purses are not procurement capital. Existing commitments from other purposes remain unavailable.

A review releases the backing of its own managed input orders before reassigning the budget. It then processes the configured `input_priority` list in order. This prevents a lower-priority commitment from trapping money required for a higher-priority shortage. Other explicit buyer orders are respected and are not cancelled by this manager.

Managed order IDs remain `buffer:<industry account>:<commodity>`, preserving the existing order namespace. Unchanged quantities and bids preserve their market creation priority. Changed orders are amended through the existing market API; fulfilled or unnecessary orders are closed or cancelled. Accepted delivery terms are never rewritten.

The bid is the existing local reference price multiplied by `bid_multiplier`, capped at the commodity baseline multiplied by `maximum_bid_multiplier`, rounded to integer microgold with a minimum of one microgold. This is an application of the Phase 3A procurement parameters, not a new scarcity model. Local matching preserves the standing market rule: highest bids and lowest asks first, then creation sequence and stable IDs; the older side sets the compatible clearing price.

Factory reviews are ordered by stable account ID. All orders from the reviewed factories are established before local matching. Equal bids therefore have deterministic priority. Competition does not guarantee equal allocation of scarce stock; remaining funded demand stays in the book for later supply.

Affordable fractional quantities are calculated with BigInt arithmetic at the market's billionth-unit quantity precision. Commitment rounding uses a ceiling and retains the existing invoice-carry guard on amended partially filled orders. This cannot commit more integer microgold than is spendable. Financial settlement retains the market's cumulative invoice rounding and exact recipient conservation.

## Scheduling, waiting and inspection

`review_interval_seconds` controls reviews on the simulation clock. A new factory is eligible on the next simulation step after completion. Large elapsed increments perform one current review and schedule the next boundary instead of replaying stale procurement cycles. Repeated inspection or rendering never triggers a review.

The read-only `getIndustryProcurement(accountId?)` API calculates current coverage and exposes:

| State | Meaning |
| --- | --- |
| `READY` | Every usable input buffer has reached its target |
| `WAITING_FUNDS` | Some required quantity remains uncovered by available operating funds |
| `WAITING_MARKET` | Required inputs are covered by funded orders awaiting supply |
| `WAITING_DELIVERY` | Purchased inbound goods cover demand but still need physical unloading |
| `WAITING_STORAGE` | Reserved or otherwise occupied input storage leaves no room for required usable stock |

Mixed shortages retain per-input details, so a factory can have funded orders while reporting an unfunded shortfall. Empty accounts remain in a finite waiting state, reviewed only at the configured cadence. No grants, automatic capital transfers or replenishment occur.

## Atomicity and verification

A review batches managed commitment changes, self-allocation and local fills. Failure restores accounts, commitments, market records, goods, transaction history, market revision and review scheduling. Observer events are deferred until commit; observer exceptions cannot replay settlement.

Run `node tests/industrial-procurement.test.mjs` for competing factories, all five configured chains, funds and priority limits, partially unloaded imports, self-allocation, protected offers, existing external orders, commitment shrink/reassignment, empty accounts, capacity constraints, foreign-catchment rejection, injected failure, read-only inspection, timing equivalence and microgold rounding.

The real worker construction test verifies that newly completed factories expose independent procurement coverage and commitments. The integrated Phase 2 voyage scenario still reconciles **4,500.00 gold opening and closing**, with zero unexplained microgold and explained goods sources/sinks. Its timed-handling assertions now distinguish legitimate local industrial input purchases from forbidden repeated merchant payment. The mixed-owner factory fixture supplies both configured buffers through a fixed explicit ask, rather than assuming the former one-batch demand.

Legacy production, market settlement, navigation, purses, construction and ownership regressions remain covered. Procurement does not add production timing, output selling policies, autonomous investment, new chains or automatic funding. Browser visual QA was unavailable; worker, client and economic checks are headless.
