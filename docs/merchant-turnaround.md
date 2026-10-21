# Merchant turnaround at the berth

Automatic merchants capture a detached price ledger at physical docking contact, after two-way ledger exchange and before their first unloading sale. Budgeted next-voyage planning begins against that frozen arrival knowledge. Unloading runs concurrently and never depends on planning completion. The ship’s own delivery therefore cannot change the prices used to choose its next job.

The planner forecasts an empty hold and expected incoming sale proceeds. Actual wallet, available stock and capacity still govern purchases after unloading; forecast proceeds are never credited as cash. A viable next cargo order begins loading at the same berth under a separate voyage journal. Purchase prices and taxes lock when loading begins, as before.

An empty ship waits at most `merchant.turnaround_wait_seconds` (default 15 simulated seconds) for unfinished planning. On timeout the job is cancelled and the ship releases its berth for anchorage. If the departure lane is temporarily blocked, it enters a retryable idle-at-port state rather than restarting empty unloading cycles. Planner errors appear in trade debug details and do not block cargo service.

Shared route searches detect cancelled owners and invalidated planning revisions. Waiting ships retry the search; cancelled generators clean up their pending cache entries without deleting newer replacements. Removing a vessel also cancels its searches.

An empty merchant cannot buy the commodity it just delivered at that delivery port for an immediate return to its recorded source. Other commodities on the return leg and the same commodity at an onward destination remain eligible. Cargo that has not sold may still be rerouted. This uses the ship’s own delivery history, with no knowledge of other ships’ intentions.

Runtime revisions restart pending selection against the same arrival-time knowledge. Existing locked purchase quotes remain unchanged. Military vessels remain excluded from commodity trading; controlled trials can disable autonomous trading with `auto_trade:false`.

## Verification

Turnaround tests cover concurrent unloading, frozen arrival knowledge, same-berth loading, timed service, separate journals, locked prices, failed and stalled planners, departure-lane congestion and the immediate commodity-return guard. Shared-route tests cover explicit cancellation and nonce invalidation, including replacement-cache safety. The full regression suite also exercises native sailing, docking, configuration, observation independence and generated fleets.
