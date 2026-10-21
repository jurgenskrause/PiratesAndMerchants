# Phase 2 completion and conservation report

This controlled scenario runs the active EconomicEngine and native BridgeLogistics. It exercises funded local manufacturing, revenue shares, whole-unit pickups, time-based sailing and handling, sea-time purses, destination settlement, immediate partial delivery acceptance, dumping, zero-wallet completion, deferred retirement and material-only construction. Automatic route selection is disabled to make the supplied voyage reproducible. Separate planner tests cover finite fallback and detached remote observations. The manufacturing worker share remains the existing provisional 25% tuning value.

## Exact money reconciliation

| Metric | Microgold | Gold |
| --- | --- | --- |
| Opening grants | 4500000000 | 4500.00 |
| Closing accounts including purses | 4500000000 | 4500.00 |
| Unexplained change | 0 | 0.00 |

Every checkpoint conserves integer microgold. Commitments are restrictions within balances, not additional gold. No active unexplained money source or sink remains. Harbor/faction upkeep and direct construction charges are absent. Shortfalls are diagnostics, not payable balances.

## Explicit initialization grants

| Account | Owner type | Owner | Microgold | Gold | Reason |
| --- | --- | --- | --- | --- | --- |
| FACTION:ENGLAND | FACTION | ENGLAND | 500000000 | 500.00 | Retained faction initial treasury |
| FACTION:FRANCE | FACTION | FRANCE | 0 | 0.00 | Retained faction initial treasury |
| FACTION:SPAIN | FACTION | SPAIN | 0 | 0.00 | Retained faction initial treasury |
| FACTION:PIRATES | FACTION | PIRATES | 0 | 0.00 | Retained faction initial treasury |
| PORT:A | PORT | A | 1000000000 | 1000.00 | Initial port population funds |
| PORT_TAX:A | PORT_TAX | A | 0 | 0.00 | Opening pending tax receipts |
| PORT:B | PORT | B | 1000000000 | 1000.00 | Initial port population funds |
| PORT_TAX:B | PORT_TAX | B | 0 | 0.00 | Opening pending tax receipts |
| INDUSTRY:distillery | INDUSTRY | distillery | 1000000000 | 1000.00 | Initial industry working capital |
| MERCHANT:vessel-1 | MERCHANT | vessel-1 | 1000000000 | 1000.00 | Initial vessel seed capital |
| SAILORS_PURSE:vessel-1 | SAILORS_PURSE | vessel-1 | 0 | 0.00 | initial capital |
| MAINTENANCE_PURSE:vessel-1 | MAINTENANCE_PURSE | vessel-1 | 0 | 0.00 | initial capital |

## Closing balances and commitments

| Account | Owner | Balance microgold | Gold | Committed microgold | Spendable microgold | Active |
| --- | --- | --- | --- | --- | --- | --- |
| FACTION:ENGLAND | FACTION: ENGLAND | 500000000 | 500.00 | 0 | 500000000 | true |
| FACTION:FRANCE | FACTION: FRANCE | 0 | 0.00 | 0 | 0 | true |
| FACTION:SPAIN | FACTION: SPAIN | 0 | 0.00 | 0 | 0 | true |
| FACTION:PIRATES | FACTION: PIRATES | 0 | 0.00 | 0 | 0 | true |
| PORT:A | PORT: A | 2535890855 | 2535.89 | 0 | 2535890855 | true |
| PORT_TAX:A | PORT_TAX: A | 0 | 0.00 | 0 | 0 | true |
| PORT:B | PORT: B | 301840890 | 301.84 | 301840889 | 1 | true |
| PORT_TAX:B | PORT_TAX: B | 0 | 0.00 | 0 | 0 | true |
| INDUSTRY:distillery | INDUSTRY: distillery | 1162268255 | 1162.27 | 0 | 1162268255 | true |
| MERCHANT:vessel-1 | MERCHANT: vessel-1 | 0 | 0.00 | 0 | 0 | false |
| SAILORS_PURSE:vessel-1 | SAILORS_PURSE: vessel-1 | 0 | 0.00 | 0 | 0 | false |
| MAINTENANCE_PURSE:vessel-1 | MAINTENANCE_PURSE: vessel-1 | 0 | 0.00 | 0 | 0 | false |

| Owner class | Total microgold | Gold |
| --- | --- | --- |
| FACTION | 500000000 | 500.00 |
| PORT | 2837731745 | 2837.73 |
| PORT_TAX | 0 | 0.00 |
| INDUSTRY | 1162268255 | 1162.27 |
| MERCHANT | 0 | 0.00 |
| SAILORS_PURSE | 0 | 0.00 |
| MAINTENANCE_PURSE | 0 | 0.00 |

| Commitment | Account | Microgold |
| --- | --- | --- |
| market:buffer:PORT:B:RUM | PORT:B | 201840889 |
| market:buffer:PORT:B:WOOD | PORT:B | 100000000 |

## Acceptance and physical handling

| Stage | Total microgold | Committed microgold | Pending transfers | Reserved goods records |
| --- | --- | --- | --- | --- |
| Production, locally funded inputs, manufacturing, wages, consumption and finite buffer bids | 4500000000 | 900000000 | 0 | 0 |
| Origin purse settlement | 4500000000 | 900000000 | 0 | 0 |
| Immediate purchases, producer split and reserved paid pickups | 4500000000 | 900000000 | 2 | 2 |
| Sea accrual, once-only purse settlement, funded arrival acceptance, partial sale and ownership aboard | 4500000000 | 200000000 | 2 | 2 |
| Paid unloading without a second payment; unsold remainder returned on removal | 4500000000 | 200000000 | 0 | 0 |
| Further production, manufacturing, consumption and material-only construction | 4500000000 | 301840889 | 0 | 0 |

Closing pending transfers: **0**. Completed transfers: **4**. Intermediate records in the JSON preserve each buyer-owned delivery aboard and merchant-owned pickup ashore. No transfer or reservation adds another copy of goods.

| Transfer | Kind | Owner | Destination | Handled units | Status |
| --- | --- | --- | --- | --- | --- |
| transfer:pickup:pickup%3Avessel-1%3A1%3A1%3AWOOD:offer-1 | PICKUP | MERCHANT:vessel-1 | SHIP:vessel-1 | 6 | COMPLETED |
| transfer:pickup:pickup%3Avessel-1%3A1%3A1%3ARUM:offer-3 | PICKUP | MERCHANT:vessel-1 | SHIP:vessel-1 | 1 | COMPLETED |
| transfer:delivery:dock%3Avessel-1%3A2%3AWOOD:buffer%3APORT%3AB%3AWOOD | DELIVERY | PORT:B | TOWN:B | 5 | COMPLETED |
| transfer:delivery:dock%3Avessel-1%3A2%3ARUM:buffer%3APORT%3AB%3ARUM | DELIVERY | PORT:B | TOWN:B | 1 | COMPLETED |

## Actual-price financial history

| Buyer | Commodity | Quantity | Payment microgold | Actual fills and recipients |
| --- | --- | --- | --- | --- |
| INDUSTRY:distillery | WOOD | 0.5 | 2844632 | PORT:A: 0.5 @ 5.69; PORT:A: 2844632 |
| INDUSTRY:distillery | SUGAR | 2 | 16911908 | PORT:A: 2 @ 8.46; PORT:A: 16911908 |
| INDUSTRY:distillery | WOOD | 0.5 | 2898901 | PORT:A: 0.5 @ 5.80; PORT:A: 2898901 |
| INDUSTRY:distillery | SUGAR | 2 | 18862656 | PORT:A: 2 @ 9.43; PORT:A: 18862656 |
| PORT:A | RUM | 0.25 | 50000000 | INDUSTRY:distillery: 0.25 @ 200.00; INDUSTRY:distillery: 37500000, PORT:A: 12500000 |
| MERCHANT:vessel-1 | WOOD | 6 | 35461182 | PORT:A: 6 @ 5.91; PORT:A: 35461182 |
| MERCHANT:vessel-1 | RUM | 1 | 200000000 | INDUSTRY:distillery: 1 @ 200.00; INDUSTRY:distillery: 150000000, PORT:A: 50000000 |
| PORT:B | WOOD | 5 | 500000000 | MERCHANT:vessel-1: 5 @ 100.00; MERCHANT:vessel-1: 500000000 |
| PORT:B | RUM | 1 | 200000000 | MERCHANT:vessel-1: 1 @ 200.00; MERCHANT:vessel-1: 200000000 |
| PORT:A | RUM | 0.25 | 50000000 | INDUSTRY:distillery: 0.25 @ 200.00; INDUSTRY:distillery: 37500000, PORT:A: 12500000 |
| INDUSTRY:distillery | WOOD | 0.5 | 3375130 | PORT:A: 0.5 @ 6.75; PORT:A: 3375130 |
| INDUSTRY:distillery | SUGAR | 2 | 17838518 | PORT:A: 2 @ 8.92; PORT:A: 17838518 |

Merchant deliveries credit only the merchant. Eligible industry sales pay their specific producing owner and parent port once; imported resale pays the current owner. Each recipient sum exactly matches the funded debit.

## Explained goods sources and sinks

| Goods | Opening | Created | Removed | Closing | Residual |
| --- | --- | --- | --- | --- | --- |
| WOOD | 30 | 4 | 3.25 | 30.75 | 0 |
| SUGAR | 20 | 6 | 4 | 22 | 0 |
| RUM | 1 | 3 | 1 | 3 | 0 |

| Goods | Operation | Quantity |
| --- | --- | --- |
| WOOD | created:primary production | 4 |
| WOOD | removed:manufacturing input | 1 |
| WOOD | removed:dumping | 0.25 |
| WOOD | removed:town consumption | 1 |
| WOOD | removed:construction | 1 |
| SUGAR | created:primary production | 6 |
| SUGAR | removed:manufacturing input | 4 |
| RUM | created:primary production | 0 |
| RUM | removed:town consumption | 1 |
| RUM | created:manufacturing output | 3 |

Primary production creates wood and sugar. Manufacturing converts purchased inputs into rum. Town consumption, explicit dumping and material-only construction are recorded sinks. Cargo has no spoilage. Ownership changes, reservations, local allocations and physical handling create or remove no goods. Goods retain floating quantity precision; the scenario residuals are zero within that precision.

## Compatibility and remaining work

- Flat trade/quote APIs return migration errors

- depositCargo permits same-owner local allocation only

- Headless operator load/sell explicitly accept and handle funded transfers

- Recorded external capture and initialization are administrative goods sources

Flat settlement/quote methods return migration errors. Public raw pickup fills and public merchant orders are rejected; purchases use capacity-checked acceptance. depositCargo permits only same-owner movement within one local catchment. The test-only market adapter submits explicit funded intents through the production book and never substitutes a production settlement implementation. Administrative actor removal returns funds and goods to documented registration owners; inbound buyers and outstanding handling cannot be retired directly. No active caller was found bypassing funded ownership or handling. New pricing, price floors, expansion, chains and shipbuilding remain outside Phase 2.

## Reproduction and limits

Run `node tests/phase2-conservation.test.mjs`, `node tests/partial-sales.test.mjs`, `node tests/phase2-boundaries.test.mjs`, and `node scripts/phase2-conservation-report.mjs`. The full regression includes acceptance, funding, deterministic matching, rounding, step-size handling, concurrency, removal, rollback, history bounds and navigation. UI assertions are headless DOM tests; no interactive browser visual check was performed. Lifecycle, matching and rounding contracts are documented in `funded-markets-phase2.md`.

## Final validation

All 100 regression suites pass after migrating the traffic fixture to explicit detached surveys and measuring motion during funded voyages. Focused settlement, transfer lifecycle, rounding, fallback, inspection and conservation checks also pass on the final source. Catalog validation, JavaScript syntax checks and `git diff --check` pass.
