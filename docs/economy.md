> Precision and treasury-upkeep descriptions below are superseded by [interphase 1F–1I](economic-cleanup-interphase.md).

# Layer 1 economic engine

`dist/economy.js` is the active headless economic engine, with its typed contract in
`economy.d.ts`. `createPortEconomy(world)` connects generated primary producers and
individual manufacturing instances to their parent ports. The merchant worker uses
this same engine; the compatibility logistics engine shares its settlement service.

Accounts identify port population treasuries, factory operating funds, merchant
wallets, ship purses and retained faction funds. GoodsInventory identifies each live
quantity's owner, physical location, reservation, origin and acquisition cost. Port
stock values and ship manifests are projections. See [goods ownership](goods-ownership-phase1c.md)
and [current revenue rules](revenue-distribution-phase1d.md).

Trades are funded atomic transfers of money and goods. Available stock excludes
construction holds and private internal stores. Loading quotes lock the unit market
price while actual batches settle during existing timed handling. Trade taxation is
removed: buyers pay the market price, merchant deliveries receive it in full, and
eligible factory output divides that payment between operating funds and parent-port
worker income. Own-store movement is allocation without payment. Imported resale
pays its current owner without restoring manufacturing wage eligibility.

Primary production enters its configured market or town pool. Individual factories
purchase missing recipe inputs into their own internal stores and convert only their
own supplies, with existing fractional batches. Town consumption uses only town
internal supplies. Governor allocation moves only the town's own unreserved goods.
Construction reservations tag quantities already present, then move fulfilled
materials into explicitly reserved construction storage until actual use.

The existing bounded inverse-power price calculation is unchanged: zero availability
uses ten times base price, availability at least ten times target uses one tenth base
price, and intermediate prices use the configured elasticity in log space. No new
price floors or procurement orders are implemented.

Tick processing creates/removes identifiable production and consumption quantities,
runs funded manufacturing, fulfills FIFO construction holds, updates prices,
preserves opening legacy tax funds and publishes signals.
Inspection is read-only. Mutation during dispatch is rejected; observer failures do
not undo completed payments. Scarcity/surplus and stalled-reservation signals retain
their existing behavior.

Retained faction funds stay separate from port population funds. Opening pending tax
receipts are transferred once to their faction, with no new tax accrual.
Harbor and faction upkeep have been removed. Construction consumes port-owned
materials without a gold charge or self-payment. Acquisition from another owner
uses funded settlement. Ship overhead moves through funded sea-time purses and
settles at the destination, as described in
[Phase 1E](ship-running-costs-phase1e.md). The active Phase 1 paths now reconcile
money exactly, including material-only construction.

The stock, governor, financial and history inspection interfaces remain available.
Run the economy, supplies, atomic-payments, goods-ownership and revenue-distribution
tests for the core contracts; merchant, worker and voyage suites verify integration.

Phase 1 verification is recorded in [the integrated conservation report](phase1-conservation-report.md).
The report lists remaining monetary sinks and legacy mutation holes; Phase 1 is not complete.
