# Phase 1B: atomic payments and funded merchant transactions

## Implemented contract

`EconomicAccounts.preparePayment(payer, credits, {id, reason})` validates the
payer and recipients, aggregates split recipients, checks funding and numeric
limits, then commits funds without debiting the balance. `spendable` excludes
these commitments. `commitPayment(token, {apply, rollback})` applies debit,
credits and cargo/stock effects together. Failures restore account balances and
commitments and call the effect rollback. `pay` releases a failed preparation;
a directly prepared token can be inspected, retried or cancelled. Tokens cannot
be forged, and committed tokens cannot apply effects twice. Explicit payment IDs
reject conflicting definitions and preserve idempotency for the session.

Positive initial capital remains restricted to account creation during the explicit
initialization boundary. No runtime payment tops up its payer. Existing 1A
compatibility balance setters are retained and their source/sink effects remain
visible in `legacyMutations`; they are not treated as conserved payments.

Observers run only after money, stock and cargo commit. Observer failures are
caught and retained separately (32 recent errors), never roll back payments and
never require retry. Engine market observers also remain isolated. Receipts and
inspection snapshots are read-only. Financial snapshots include opening/live
holdings and 256 recent payment receipts. Explicit idempotency keys remain for the
session; automatically generated tokens use weak storage and do not accumulate
unlimited transaction history.

## Trade settlement

`executeTransaction` and `executePurchaseQuote` accept explicit `buyerAccountId`,
`sellerAccountId`, `merchantAccountId`, optional `transactionId`, and reversible
cargo effects. An AI ship ID resolves its registered MERCHANT account.

Until 1C attributes detailed goods ownership, the local PORT treasury is the
explicit temporary seller of pooled market stock and buyer of merchant deliveries.
Callers can instead name an INDUSTRY account. An unidentified counterpart is
rejected (`ACCOUNT_REQUIRED`); an unknown account is rejected (`UNKNOWN_ACCOUNT`).
Neither a missing nor empty buyer is replaced by an unlimited market account.

The current tax model is deliberately retained until 1D:

| Operation | Payer | Credits |
| --- | --- | --- |
| Purchase | Merchant or explicit buyer | Gross goods price to identified seller; tax to PORT_TAX |
| Delivery | Explicit buyer, normally port | Gross minus tax to merchant; tax to PORT_TAX |
| Economic tick tax sweep | PORT_TAX | Exact transferred amount to FACTION |

Partial quantities are limited by buyer spendable funds and available pickup stock.
The existing quoted purchase price is preserved. Quote progress participates in
rollback and updates before observers. Explicit transaction retries do not repeat
stock changes, payment, cargo effects or market events.

Settlement occurs per physically handled batch. It does not introduce Phase 2's
whole-load arrival commitment or purchase-order behavior. An empty merchant wallet
cannot load new cargo but does not prevent selling/unloading to a funded buyer.
Failed loading releases the attempt rather than retrying forever. With an empty
destination treasury, the active BridgeLogistics retains unsold cargo and leaves
unloading for anchorage/replanning; it does not delete the cargo or mint proceeds.
Its next-load forecast is bounded by destination spendable funds.

Both active BridgeLogistics and the compatibility LogisticsEngine now use registered
merchant accounts and atomic cargo effects. Their callers no longer independently
debit/credit wallets after a successful transaction. Both session types seal initial
capital and use funded subsequent vessel creation. Retiring compatibility ships
returns their cash to their registered port (or faction when unregistered).

Port/industry initial-fund defaults remain zero from 1A. A generated destination
with no revenue or configured opening capital can therefore refuse delivery. Set
`economy.port_starting_gold` explicitly when a funded trading scenario is desired;
there is no automatic top-up. Existing navigation/history test fixtures that
require paying markets now declare opening counterpart capital explicitly.

## Remaining financial work

| Path | Remaining behavior | Planned conversion |
| --- | --- | --- |
| BridgeLogistics.bridgeTick | Crew/hull overhead is still a legacy debit with no receiving account, including anchored ships | 1E sea-time purses and destination settlement |
| LogisticsEngine.tick | Compatibility overhead has the same legacy sink | 1E or retire this compatibility implementation |
| EconomicEngine.purchaseInfrastructure | Faction account pays construction; payment has no economic recipient; failure rollback restores it | Define construction recipient and convert to atomic payment |
| InfrastructureGovernor.tick | Dock upkeep debits faction through modifyTreasuryBalance with no recipient | Define upkeep recipient and convert |
| EconomicEngine.tick daily upkeep | Faction overhead disappears from holdings | Define funded expenditure recipient |
| EconomicEngine.modifyTreasuryBalance | Retained public positive/negative adjustment changes holdings through the legacy service | Replace adjustment callers with identified transfers/initialization grants |
| Compatibility wallet setters / legacySet | Direct debugging/test balance edits still produce explicit legacy net deltas | Restrict or remove once all legacy consumers migrate |
| Pooled market ownership | PORT receives gross purchases even for manufactured/imported stock unless caller identifies another seller | 1C owner attribution; 1D worker share |
| Existing trade taxes | Funded and conserved, but still charged and swept to faction | 1D agreed revenue distribution |

No live trade path now creates merchant sale proceeds or discards merchant purchase
proceeds. Conservation is still incomplete because the listed legacy expense paths
remove funds. There are no industry purchase orders, manufacturing wage splits,
new pricing, expansion policies or shipbuilding changes in this phase.

## Verification

`atomic-payments.test.mjs` checks fully/partly/unfunded transactions, commitments,
split totals, invalid inputs, unknown accounts, numeric limits, duplicate IDs,
read-only receipts, observer failure, industry-funded purchases and tax conservation.
`atomic-cargo.test.mjs` injects a journal failure during loading and verifies rollback
of gold, stock, manifest, quote progress and voyage accounting. It checks observer
visibility, zero-wallet unloading, retained cargo against an empty buyer and exit
from a failed loading state.

Existing stock/price/history fixtures use an explicitly funded test counterpart;
this is confined to tests. Sailing and soak fixtures declare opening port budgets
so their journey-completion assertions continue to exercise physical logistics.

Final validation: all 84 test suites passed, including the simulation soak tests.
Data validation, module-version checks and `git diff --check` also passed.
