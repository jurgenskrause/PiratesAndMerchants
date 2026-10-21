# Phase 1 integrated conservation verification — microgold

Controlled replay of the active EconomicEngine, BridgeLogistics, native routes, guided docking, paid handling and ship-running-cost services. Two ports, one individual distillery, a separate zero-grant local procurement owner and one merchant run two explicit production ticks and 40.70000000000025 simulation seconds. Automatic job selection is disabled; native sailing and timed cargo handling execute the supplied voyage. The worker share is the existing **25% provisional tuning default**. No simulation algorithms are mocked. The procurement owner receives a funded transfer from its parent port for the imported resale probe; it introduces no opening gold.

## Exact money reconciliation

| Metric | Microgold | Gold |
| --- | --- | --- |
| Opening | 3707000000 | 3707.00 |
| Initialization grants | 3707000000 | 3707.00 |
| Closing, including purses | 3707000000 | 3707.00 |
| Unexplained change | 0 | 0.00 |

Every financial checkpoint conserves integer units exactly. Harbor and faction upkeep no longer deduct gold. Direct balance adjustments are rejected. Construction consumes one unit of port-owned wood without a gold charge. No remaining active money creation or destruction path was found in the Phase 1 audit.

## Explicit initialization grants

| Account | Owner type | Owner | Microgold | Gold | Reason |
| --- | --- | --- | --- | --- | --- |
| FACTION:ENGLAND | FACTION | ENGLAND | 500000000 | 500.00 | Retained faction initial treasury |
| FACTION:FRANCE | FACTION | FRANCE | 0 | 0.00 | Retained faction initial treasury |
| FACTION:SPAIN | FACTION | SPAIN | 0 | 0.00 | Retained faction initial treasury |
| FACTION:PIRATES | FACTION | PIRATES | 0 | 0.00 | Retained faction initial treasury |
| PORT:A | PORT | A | 1000000000 | 1000.00 | Initial port population funds |
| PORT_TAX:A | PORT_TAX | A | 7000000 | 7.00 | Opening pending tax receipts |
| PORT:B | PORT | B | 1000000000 | 1000.00 | Initial port population funds |
| PORT_TAX:B | PORT_TAX | B | 0 | 0.00 | Opening pending tax receipts |
| INDUSTRY:distillery-A | INDUSTRY | distillery-A | 200000000 | 200.00 | Initial industry working capital |
| MERCHANT:vessel-1 | MERCHANT | vessel-1 | 1000000000 | 1000.00 | Initial vessel seed capital |
| SAILORS_PURSE:vessel-1 | SAILORS_PURSE | vessel-1 | 0 | 0.00 | initial capital |
| MAINTENANCE_PURSE:vessel-1 | MAINTENANCE_PURSE | vessel-1 | 0 | 0.00 | initial capital |
| INDUSTRY:resale-buyer | INDUSTRY | resale-buyer | 0 | 0.00 | Explicit local procurement buyer |

Opening pending-tax money transfers once to retained faction funds. No new trade tax or recurring grant occurs. Retained faction wealth stays separate from port population wealth.

## Closing accounts and purses

| Account | Owner | Balance units | Gold | Committed units | Spendable units | Active |
| --- | --- | --- | --- | --- | --- | --- |
| FACTION:ENGLAND | FACTION: ENGLAND | 507000000 | 507.00 | 0 | 507000000 | true |
| FACTION:FRANCE | FACTION: FRANCE | 0 | 0.00 | 0 | 0 | true |
| FACTION:SPAIN | FACTION: SPAIN | 0 | 0.00 | 0 | 0 | true |
| FACTION:PIRATES | FACTION: PIRATES | 0 | 0.00 | 0 | 0 | true |
| PORT:A | PORT: A | 1089460185 | 1089.46 | 0 | 1089460185 | true |
| PORT_TAX:A | PORT_TAX: A | 0 | 0.00 | 0 | 0 | true |
| PORT:B | PORT: B | 571840890 | 571.84 | 0 | 571840890 | true |
| PORT_TAX:B | PORT_TAX: B | 0 | 0.00 | 0 | 0 | true |
| INDUSTRY:distillery-A | INDUSTRY: distillery-A | 236905092 | 236.91 | 0 | 236905092 | true |
| MERCHANT:vessel-1 | MERCHANT: vessel-1 | 1221792056 | 1221.79 | 0 | 1221792056 | true |
| SAILORS_PURSE:vessel-1 | SAILORS_PURSE: vessel-1 | 666 | 0.00 | 0 | 666 | true |
| MAINTENANCE_PURSE:vessel-1 | MAINTENANCE_PURSE: vessel-1 | 1111 | 0.00 | 0 | 1111 | true |
| INDUSTRY:resale-buyer | INDUSTRY: resale-buyer | 80000000 | 80.00 | 0 | 80000000 | true |

Purses hold funded gold, unavailable to merchant planning. Native idle behavior can begin another sea interval after delivery, so any closing purse money remains aboard until the next docking.

## Checkpoints

| Stage | Gold | Unexplained change |
| --- | --- | --- |
| Primary production, industry-funded inputs and manufacturing | 3707.00 | 0.00 |
| Town purchase, own-stock allocation, second production and consumption | 3707.00 | 0.00 |
| Origin docking and purse settlement | 3707.00 | 0.00 |
| Merchant purchases primary and individual-factory output | 3707.00 | 0.00 |
| Dump 0.5 merchant-owned wood | 3707.00 | 0.00 |
| Sea-time accrual and destination settlement | 3707.00 | 0.00 |
| Funded deliveries | 3707.00 | 0.00 |
| Imported manufactured goods resold to current buyer without producer reward | 3707.00 | 0.00 |
| Material-only construction consumes owned wood without a payment | 3707.00 | 0.00 |

## Funded trade history

| Buyer | Goods | Quantity | Payment units | Recipients |
| --- | --- | --- | --- | --- |
| INDUSTRY:distillery-A | WOOD | 0.5 | 4459630 | PORT:A: 4459630 |
| INDUSTRY:distillery-A | SUGAR | 2 | 16069876 | PORT:A: 16069876 |
| INDUSTRY:distillery-A | WOOD | 0.5 | 4715664 | PORT:A: 4715664 |
| INDUSTRY:distillery-A | SUGAR | 2 | 20000000 | PORT:A: 20000000 |
| PORT:A | RUM | 0.25 | 48714752 | INDUSTRY:distillery-A: 36536064; PORT:A: 12178688 |
| PORT:A | WOOD | 1 | 0 | Own-stock allocation |
| INDUSTRY:distillery-A | WOOD | 0.5 | 5000000 | PORT:A: 5000000 |
| INDUSTRY:distillery-A | SUGAR | 2 | 20000000 | PORT:A: 20000000 |
| MERCHANT:vessel-1 | WOOD | 3 | 31904571 | PORT:A: 31904571 |
| MERCHANT:vessel-1 | RUM | 1 | 94152263 | INDUSTRY:distillery-A: 70614198; PORT:A: 23538065 |
| PORT:B | WOOD | 2.5 | 250000000 | MERCHANT:vessel-1: 250000000 |
| PORT:B | RUM | 1 | 100000000 | MERCHANT:vessel-1: 100000000 |
| INDUSTRY:resale-buyer | RUM | 0.1 | 20000000 | PORT:B: 20000000 |

Raw output pays its port owner. Fresh manufactured output pays its exact producing industry and parent port once. Merchant deliveries pay the merchant in full. Resale of imported rum pays its current port owner without rewarding the original factory again. Each recipient sum equals the buyer debit in integer units.

## Sea-time costs

| Metric | Value |
| --- | --- |
| elapsedSeaSeconds | 40.33333333333233 |
| pendingSeaSeconds | 0.03333333333333333 |
| fundedSailorsUnits | 806666 |
| fundedMaintenanceUnits | 1344444 |
| unfundedSailorsUnits | 0 |
| unfundedMaintenanceUnits | 0 |
| settledUnits | 2149333 |
| fundedSailors | 0.806666 |
| fundedMaintenance | 1.344444 |
| unfundedSailors | 0 |
| unfundedMaintenance | 0 |
| settledGold | 2.149333 |
| fractionalSailorsMicrogold | 0.666666666758374 |
| fractionalMaintenanceMicrogold | 0.4444444444443434 |
| dockings | 2 |

Latest settlement: `{"portId":"B","sailorsUnits":690334,"maintenanceUnits":1150556,"totalUnits":1840890,"sailors":0.690334,"maintenance":1.150556,"total":1.84089,"seaSeconds":34.51666666666599,"docking":2}`. Origin docking receives approach costs; destination docking receives the later sea leg. Docked handling does not accrue sea costs. Inspection leaves balances and accrual unchanged. Fractional microgold is a rate accumulator, not an owned purse balance or payable debt.

## Goods reconciliation

| Goods | Opening | Created | Removed | Closing | Quantity residual |
| --- | --- | --- | --- | --- | --- |
| WOOD | 10 | 2 | 2.5 | 9.5 | 0 |
| SUGAR | 10 | 4 | 4 | 10 | 0 |
| RUM | 3 | 3 | 0 | 6 | 0 |

| Goods | Explicit source / sink | Quantity |
| --- | --- | --- |
| WOOD | created:primary production | 2 |
| WOOD | removed:manufacturing input | 1 |
| WOOD | removed:dumping | 0.5 |
| WOOD | removed:construction | 1 |
| SUGAR | created:primary production | 4 |
| SUGAR | removed:manufacturing input | 4 |
| RUM | created:primary production | 0 |
| RUM | created:manufacturing output | 3 |

Production creates port-owned wood and sugar. Manufacturing converts industry-owned inputs to rum (2 sugar and 0.5 wood → 1.5 rum per tick). Town consumption removes internal rum; cargo has no spoilage; dumping removes 0.5 paid wood without proceeds; construction removes one port-owned wood. Transfers and allocations create no goods. Physical quantities retain floating-point precision; tiny quantity residuals are checked within that precision. Closing ownership and provenance are in the JSON report.

## Construction and restricted APIs

| Path | Status |
| --- | --- |
| EconomicEngine.purchaseInfrastructure | Material-only construction; owned goods consumed with atomic placement rollback. No gold charge, financial receipt or self-payment. The construction sink API has been removed. |
| InfrastructureGovernor harbor upkeep / faction daily upkeep | Removed; legacy upkeep seed ignored and catalog controls deleted. |
| modifyTreasuryBalance / legacySet / bound balance setters | Nonzero direct adjustments rejected; equal-value compatibility writes cannot change stored units. |
| Ship removal | Wallet and both funded purses swept to explicit recipient; full restart opens a separate session. |

## Separate probes

| Probe | Opening gold | Closing gold | Change gold |
| --- | --- | --- | --- |
| Material-only construction: legacy gold cost ignored | 200.00 | 200.00 | 0.00 |
| Daily faction upkeep: EconomicEngine.tick | 200.00 | 200.00 | 0.00 |
| Positive legacy treasury API (no positive active caller found) | 200.00 | 200.00 | 0.00 |
| Restricted legacy setter preserves microgold | 1000000.00 | 1000000.00 | 0.00 |

## Reproduction

Run `node tests/phase1-conservation.test.mjs` and `node tests/microgold.test.mjs`; regenerate with `node scripts/phase1-conservation-report.mjs`. Raw diagnostic JSON preserves exact integer units and derived values; user-facing monetary labels use two decimals. See `economic-cleanup-interphase.md` for precision and migration policy.
