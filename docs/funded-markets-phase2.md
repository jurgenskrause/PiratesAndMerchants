# Phase 2: funded markets and immediate settlement

Authoritative implementation: `dist/economy.js`, `dist/economic-accounts.js`, `dist/funded-market.js` and `dist/goods-inventory.js`. The active worker uses `BridgeLogistics`; the workshop `LogisticsEngine` is also converted. Older documents using the phrase “Phase 2” for docks, roads or graphics describe different work.

## 2A: buyer-owned purchase orders

Each order identifies its buyer account, parent port, commodity, remaining quantity, bid in integer microgold, destination internal store, priority sequence and named financial commitment. Committed money remains in the buyer's total balance and is excluded from spendable funds. Several orders share the same account and cannot commit the same money twice. Amendments preflight their new backing; cancellation releases only outstanding commitments. No vessel construction order cancellation is introduced.

Port orders belong to `PORT:<id>` and deliver into `TOWN:<id>`. Manufacturing orders belong to an individual `INDUSTRY:<instance>` and deliver into that instance's `INDUSTRY:<instance>` store. `registerMarketBuyer` attaches an existing, separately funded industry account to one port as a shipyard purchaser. It creates neither money nor a shipyard production process. Shipyard procurement uses the same internal-store and funding contract; new vessel construction remains outside this phase. Merchant pickup orders are short-lived funded orders against their own wallets.

Town demand replenishes existing consumption targets for commodities with an active consumption rate. A town allocates its own available local output first, without payment. Paid inbound deliveries count toward the target but cannot be consumed yet. Industry demand uses the existing one-recipe-batch input requirement, counting owned internal supplies and paid inbound cargo. Additional manual orders are counted so automatic buffers do not duplicate their demand. Quantities are capped by funded affordability. Local eligible offers clear within a single catchment; no inter-port market matching occurs.

Initialization defaults were previously zero placeholders explicitly awaiting funded procurement. New provisional defaults are **5,000 gold per port** and **1,000 gold per manufacturing instance**, in `configuration_definitions.json`. They are explicit, one-time initialization grants, never replenished. Merchant opening capital and retained faction funds keep their previous definitions. Old worlds with explicit zero overrides still receive zero. No faction balance is copied into ports.

## 2B: owner-attributed selling offers

Available market goods are listed by economic owner. Their underlying inventory records preserve origin, cost and producer eligibility even when an owner's offer aggregates several records. Construction reservations, paid pickups and other committed goods are excluded. Production and initial available stock receive automatic offers at the existing stock-based reference price. Explicit seller offers replace the corresponding automatic allocation and can have their own asks. Cancelling an offer releases its remaining goods immediately without relisting during that cancellation. A later market refresh may list available stock automatically; it does not destroy stock.

The dispatcher selects highest bids first and lowest asks first, with FIFO sequence and stable ID tie-breakers. A local overlap clears at the older resting limit. Merchant deliveries accept the standing buyer bid; merchant pickups accept the standing seller ask. Price changes lose the previous price priority. A quote is finite depth, not permission to trade arbitrary volume. No new scarcity formula, output price floor or averaged-price pricing is introduced.

Manufactured output credits the eligible owning industry and its parent port under the Phase 1 worker-share rule. The existing 25% worker share remains provisional tuning. Rounding remainder stays with the industry. Merchant deliveries pay the merchant alone. Ownership changes remove original producer eligibility, preventing wages from being charged again on imported resale.

## 2C: immediate economic acceptance

Only the authoritative docking hook permits merchant acceptance. Travelling toward a ledger report reserves nothing. At acceptance the funded commitment, recipient credits, ownership changes, order reduction, handling reservation and merchant financial journal succeed or roll back together. A failed callback leaves funds and goods unchanged. Receipts identify the actual buyer, original seller, order, offer, transfer, quantity, payment, price and recipient shares. Observer failures are recorded after a successful commit and cannot undo or repeat it.

Arrival settles both ship purses first, then accepts available funded deliveries, then starts next-job planning. The next ship sees reduced or exhausted demand immediately. Planning uses actual spendable wallet funds; neither purse balances nor speculative proceeds from unsold cargo are purchasing capital. Native ledgers advertise bid, ask, supply and funded demand with original observation age. Ledger reports remain detached information.

Invoices use safe integer microgold. Fractional quantity multiplication carries a per-order numerator at nine-decimal quantity precision and rounds the cumulative invoice, rather than independently rounding each fragment. An order may therefore retain a zero-valued commitment identity while its already rounded invoice covers remaining tiny fragments. Closing releases unused backing. Tiny orders never become unfunded credit. Stored goods remain the existing floating quantities; no per-handling-tick lot history is created.

## 2D: physical cargo handling

| Stage | Owner | Physical location | Availability |
|---|---|---|---|
| Listed output | Port, individual industry or current merchant owner | Local market | Reserved to one selling offer |
| Accepted pickup | Merchant | Origin market | Reserved to the paid pickup; occupies intended hold capacity |
| Loaded pickup | Merchant | Ship hold | Unsold cargo available for a later delivery |
| Accepted delivery | Town/industry/shipyard buyer | Delivering ship hold | Reserved to the paid delivery, unavailable for dumping or consumption |
| Unloaded delivery | Buyer | Buyer's internal store | Usable for consumption or manufacturing |
| Existing construction hold | Recorded construction owner | Market hold or construction store | Unavailable for sale or consumption |

Pickups accumulate handling time until whole units can physically move. Unloading remains fractional and timed. Capacity includes every physical quantity aboard, regardless of owner, plus paid pickups still ashore. The merchant's unsold manifest is separate from the physical manifest and pending transfer inspection. Price and payment locks are settled acceptance records; handling callbacks never pay again.

Departure, anchoring and removal cannot abandon accepted handling. Once paid, a delivery completes despite an empty merchant wallet or a later change in the trade assessment. Stationary docked handling adds no sea-time costs. Cargo has no spoilage. Explicit dumping operates on unreserved merchant-owned cargo; buyer-owned goods in paid dockside handling are protected. Workshop interdiction rejects protected dockside handling rather than stranding its buyer-owned cargo.

## 2E: unsold cargo, retirement and observation

Partial fills leave the unsold remainder aboard with its original cost/origin information. No funded buyer means no money and no cargo deletion. The merchant can retain or explicitly dump its own unsold cargo. Dumping is a recorded goods sink with no payment. Turnaround plans retain unsold cargo and its capacity needs; completed deliveries record origin guards to prevent immediately returning the same commodity to its origin.

Fleet reduction marks a ship for retirement if paid handling is outstanding, finishes that handling and then removes it. Session fleet lists update on deferred retirement. Phase 1's documented administrative decommissioning disposition remains: wallet, sailors' purse and maintenance purse return to the registration treasury (or retained faction account fallback), and remaining merchant-owned goods are reassigned to the registration port. This is an administrative removal path, not a merchant delivery or economic revenue. Whole simulation restart discards the old accounting session and explicitly initializes a new one. Industry/buyer removal with accepted inbound goods is rejected; unfilled commitments must be cancelled before account retirement.

The workshop's old inter-port micro-trickle is removed. `transferStock` rejects inter-port transport, so market trading cannot move goods between ports without shipping. No new road or catchment connection is added.

Public order/offer/transfer inspection is read-only. Port supply and ship ledger tables show funded depth, asks and bids through the existing two-decimal money formatter. The ship inspector separates paid handling from merchant-owned cargo. Financial, trade and completed-transfer histories retain at most 256 entries; voyage history remains capped at 100. Empty orders and offers leave the active book, and completed handling reservations are removed.

## Compatibility inventory

`executeTransaction`, `quotePurchase` and `executePurchaseQuote` now return migration errors for every call. They cannot settle stock or gold. Public raw pickup fills and public merchant purchase orders are rejected; `acceptCargoPickup` supplies capacity-checked funded acceptance. `depositCargo` permits only same-owner local allocation, excluding reservations. `allocateOwnedSupplies` moves an owner's unreserved local market goods to its own internal store with no money. Local offered fills and dockside delivery fills share the authoritative atomic path.

The headless operator load/sell convenience methods explicitly accept and physically handle funded transfers. Their supplied handling budget is an operator operation, not the worker's timed navigation lifecycle. A test-only market adapter migrates older fixtures by submitting explicit buyer orders and seller offers through those same services; it is never imported by production. Administrative capture and initialization record their goods sources; neither performs an unfunded economic purchase.

The retained opening tax-pool sweep is a one-time transfer into its faction account, not new tax or money creation. Construction remains material-only. No harbor/faction upkeep or new grants are added. Existing administrative goods creation (`initializeInventory`, initialization only, and `receiveExternalCargo`, recorded capture) and actor removal remain explicit inventory operations. No unexplained active financial source or sink remains.

## Verification

Focused book tests cover commitments, failed amendments, cancellation, seller attribution, price/time priority, overlap prices, individual factory wage shares, current-owner resale, protected paid cargo, dock-only acceptance, partial fills, whole-unit pickups, fractional handling, capacity holds, failed settlement rollback, duplicate protection, tiny cumulative invoices, shipyard procurement, catchment rejection, read-only inspection and retirement.

The integrated scenario uses the actual economy and native docking/sailing/handling engine. It covers primary production, funded local input purchases, manufacturing and worker shares, town consumption, merchant pickup acceptance, timed loading, funded sea-time purses, arrival settlement, immediate partial sales, unloading with a zero wallet, stable cargo without decay, unsold dumping, deferred retirement and material-only construction. Opening and closing gold are both **4,500.00**, with **zero unexplained microgold**. Goods reconcile exactly in this scenario. Full account, grant, commitment, trade and goods-flow records are in `phase2-conservation-results.json`.

Regression fixtures that formerly assumed unlimited buyers now advertise finite funded orders or induce explicit consumption shortages. No assertions of perpetual profitable trading are justified when funded demand is exhausted; ships may safely wait. New pricing and demand tuning remain separate future work.

## 2B audit: matching and reservation contract

Matching selects the highest compatible bid and lowest compatible ask, then earlier sequence and stable ID. Local matching uses the older resting limit; merchant delivery pays the standing bid and pickup pays the standing ask. A price amendment loses priority and affects only unaccepted goods. Each fill retains its own payer, seller, commodity, source location/reservation, actual unit price, quantity, original goods attribution and recipient shares. Multiple fills remain separate; a blended price is not an executable quote.

All offers, including automatic listings, reserve their goods. Generic allocation, construction and legacy material holds exclude listed goods. Owners must cancel a listing before another use. Town buffer replenishment explicitly withdraws its own automatic listings before allocating its own goods, preserving explicit seller offers. Cancellation releases the old reservation; automatic listing can resume on a later market refresh. The headless Phase 1 adapters retain their existing single reference-price and locked-quote contract, restricted to unlisted goods and automatic supply. They exclude explicit offers and handling/construction reservations; they are not an executor for the multi-price book. Active market callers use funded-book fills, whose actual prices and sellers are recorded separately.

Inspection shows separate ask and bid price levels, each with executable quantity, and preserves the owner-attributed offers/orders. The best-price quantity is distinct from total market depth. Merchant estimates use the quantity available at their selected bid/ask rather than assuming all depth has the best price.

Construction governors explicitly opt into withdrawing their own automatic listings as part of the atomic material construction operation. This withdraws and consumes goods together on success, and restores both inventory and listings on failure without publishing a partial state. The default construction API cannot use listed goods, and the opt-in never touches explicit offers or another owner’s stock. Pending material holds take only newly unlisted production before automatic supply listing; they never confiscate an existing offer.

The 2B audit is verified by `selling-offers.test.mjs`, covering protected automatic/explicit reservations, cancellation, atomic construction withdrawal/rollback, distinct factories and origins, multiple ask levels and priced fills, fixed accepted prices, amendment priority, limit rejection and no-income self-allocation. All 96 regression suites pass, including the integrated money/goods scenario and navigation soak. The older supplies fixture was updated to withdraw listings deliberately and rerun after the full regression pass.

The 2E audit supersedes the earlier flat-quote compatibility contract: all flat quote and settlement calls now return migration errors. Mixed prices are executable only through owner-attributed offers and funded orders.

## 2C audit: one atomic delivery acceptance

`acceptCargoDelivery` accepts only a ship registered at the destination dock. The native bridge additionally requires a stationary authoritative dock/service state, rejecting approach, anchorage and movement even if a stale dock flag remains. Native docking settles funded running-cost purses before registering service, accepting deliveries or planning the next voyage.

An acceptance can fill several current orders. Reserved payments run as one synchronous settlement batch, with account observers deferred until all fills and their goods/history changes succeed. Failure restores funds, commitments, the complete order book, cargo, pending transfers, fill caches, histories and market revision. Voyage callbacks restore the journal to its pre-acceptance snapshot. Successful events expose final book state and each fill's factual metadata; observer errors are contained after commit.

Pass a stable `TradeContext.acceptanceId` when retrying the same intent. The same ship/port/commodity/quantity and ID returns its original fills without payment, ownership changes, history entries or events. Conflicting reuse is rejected. Active merchant callbacks use ship, dock-visit number and commodity; repeated dock registration does not advance the visit. A new docking starts a new intent. Explicit operator/headless calls without an ID represent new intents and receive an ID in their fills. An unsold remainder may be sold through a new intent; retries cannot silently chase replenished demand. Settlement IDs encode acceptance and order IDs without delimiter ambiguity; transfer IDs derive from settlement IDs. Expired fill identities cannot be replayed as new payments.

The merchant receives proceeds at acceptance. Purchased goods remain buyer-owned and transfer-reserved in the ship hold, absent from usable market/internal stores and unsold manifests. Timed handling moves physical goods and updates delivered quantity only. Native voyage journals record sold quantity, revenue and the sold goods' acquisition cost at acceptance; unloading cannot add those amounts again. Both public trade history and financial observer snapshots see the completed acceptance.

`dockside-commitment.test.mjs` covers two ships with the same stale ledger, exhausted and partially remaining demand, dock-only eligibility, stable retries, changed demand after acceptance, observer failures, immediate payment, protected/unusable inbound goods, multi-order rollback including history and journals, and unchanged payment during unloading. Native docking/purse ordering and zero-wallet handling remain covered by the integrated scenario and ship-running-cost tests.

Verification after the 2C audit: 97 regression suites pass, including the native navigation soak, followed by focused checks of direct delivery fills, acceptance, cargo handling, history, startup and arrival-time purse ordering. The integrated report still opens and closes at 4,500.00 gold with zero unexplained microgold or goods changes.


## Phase 2D physical transfer lifecycle

Acceptance creates `AWAITING_HANDLING`, with the buyer as economic owner, the actual source location, receiving destination, protected reservation and fixed purchased quantity. The first batch changes the status to `HANDLING`; the last changes it to `COMPLETED`, clears the remaining location/reservation and records one bounded completion receipt. Inspection exposes remaining and handled quantities without modifying them. Partial batches move existing goods; they generate no financial transaction.

| Transfer | While awaiting handling | Receiving location | Availability |
| --- | --- | --- | --- |
| Delivery | Buyer-owned, reserved in `SHIP:<ship>` | Buyer's `TOWN:<port>` or `INDUSTRY:<instance>` store | Only batches ashore are usable; remaining cargo occupies the ship and cannot be sold or dumped by the merchant. |
| Pickup | Merchant-owned, reserved in `MARKET:<port>` | `SHIP:<ship>` | Only whole loaded units enter the available manifest. Pending pickups count against hold capacity. |

Loading carries fractional time progress until a whole unit can move. Unloading can move fractional batches. A physical update rolls back all its goods and transfer changes if any move fails; publications follow successful commit. Repeating handling after completion cannot create another batch or receipt. The money remains exactly as settled at acceptance.

Native dock requests, direct visits, trade activation, departure, anchoring and fleet removal cannot interrupt accepted handling. Next-job route calculations may run while unloading, but activation and berth release wait for every paid transfer. The compatibility engine finishes already-paid unloading even if diplomatic entry permission is subsequently withdrawn. Empty wallets do not stop paid loading or unloading.

Spoilage is removed from simulation updates, commodity data/schema/types, route forecasts and inspector explanations. Explicit dumping, consumption, manufacturing conversion and construction remain explained goods sinks. New vessel orders remain irrevocable.

Verification: `paid-transfer-lifecycle.test.mjs` covers ownership/location/reservation inspection, partial receiving-store availability, capacity, whole units, empty wallets, exactly one completion, injected multi-batch failure, interruption guards, withdrawn entry permission and cargo without decay. `funded-handling.test.mjs` verifies equivalent elapsed handling at three step sizes. Integrated reports have been regenerated with no spoilage flows.


## Final 2E boundaries

`getShipInventory` separates unsold merchant-owned goods, paid deliveries aboard, paid pickups ashore and bounded completed transfers. Physical capacity counts all aboard goods and pickups committed ashore. Planning considers every unsold commodity, excludes buyer-owned delivery cargo, and reserves capacity for future pickups. Turnaround forecasts may exclude deliveries only because activation waits for completed handling. Native and workshop remote ledgers are detached observations with original timestamps/provenance; live inspection is restricted to the current local port. Workshop `receiveMarketReports` merges an explicitly supplied detached report without reading a market or granting any reservation; fixtures use it for a survey taken after setup.

A merchant accepts only currently funded demand, highest bid first, keeping separate buyer/price/recipient records for each fill. No demand retains cargo; the configured turnaround timeout ends waiting with a finite safe fallback. After accepted handling finishes, a merchant can seek another destination. Fractional historical cargo remains saleable and unloadable, while new pickups acquire whole units. No residual-dust deletion occurs.

Dumping identifies exact unreserved merchant-owned records, preserves provenance and acquisition cost in a bounded loss receipt, and changes neither accounts nor port stock nor sale history. Accepted buyer-owned goods are protected. Unknown loss reasons and removed spoilage operations are rejected. Administrative sinking/confiscation remain explicit recorded losses, separate from sales.

Pickup intent IDs protect whole multi-offer acceptance, with atomic rollback of funds, commitments, book, goods, transfer history and caller journal. Replaying an identical intent returns its original fills; conflicting or pruned intents cannot reapply payment. Native intent IDs belong to each actual job instance. Completed result histories are bounded; session identity tombstones retain only replay protection, no tick records. Physical updates have per-ship/per-direction simulation-time sequence watermarks, so duplicate or older callbacks cannot move a second batch. Manual operator handling without a sequence represents a new explicit handling budget.

Financial quantities use integer microgold and safe-integer overflow checks. Fractional invoices round the cumulative nine-decimal quantity numerator; fragments do not independently round into extra payment. Manufacturing worker shares round down to microgold and the industry retains the remainder. Whole pickups use exact integer affordability. Display formatting always has two decimals and never feeds settlement. Accepted unit prices remain immutable; history keeps individual fills and splits aggregate events by actual price. Histories are bounded at 256; each event has at most 64 fills and voyage/loss journals remain bounded.

See `phase2-completion-report.md` and `phase2-conservation-results.json` for the reproducible integrated account, commitment, transfer and goods reconciliation. There are no remaining active flat settlement, unlimited-buyer or paid-transfer bypass paths.

Final verification: 100 regression suites pass, including generated-world traffic and native navigation soak. The traffic fixture explicitly supplies its post-setup detached survey; it does not restore live remote market reads. Focused final-source accounting, transfer, whole-unit handling, ownership, dumping, UI inspection and integrated conservation checks pass.
