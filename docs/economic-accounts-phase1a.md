# Phase 1A: economic accounts and initialization

The worker's active path is `createMerchantSession` -> `createPortEconomy` ->
`EconomicEngine` plus `BridgeLogistics`. `LogisticsEngine` remains a compatibility
implementation selected only when a caller explicitly omits `bridge:true`.
The actual game worker explicitly selects BridgeLogistics. The manually controlled
player is a pose/ledger participant, not an automated economic agent with a wallet.

## Account map

| Owner type | Stable identity | Opening funds | Compatibility / lifecycle |
| --- | --- | --- | --- |
| PORT | Port ID | `economy.port_starting_gold`, default 0 | `getPortTreasury`; collective population wealth |
| INDUSTRY | Instance ID; world tile/index fallback | `economy.industry_starting_gold`, default 0 | Separate account per factory, including repeated types/counts; retirement returns funds to parent port |
| MERCHANT | Vessel ID | Existing `merchant.starting_wallet`, default 20,000 | `a.wallet` and `wallet_gold` derive from the account |
| SAILORS_PURSE | Vessel ID | 0 | Funded cash holder; accumulation/settlement deferred to 1E |
| MAINTENANCE_PURSE | Vessel ID | 0 | Funded cash holder; accumulation/settlement deferred to 1E |
| FACTION | Runtime faction ID | Existing settlement-profile treasury balance, 5,000 in generated sessions | Kept separate from PORT; `balance_gold` derives from the account |
| PORT_TAX | Port ID | Existing pending receipts, normally 0 | Transitional receipt holding account, swept into FACTION on economic tick |

Accounts expose total `balance`, `committed` and `spendable`. Commitments are zero
in 1A; reservation operations and purchase orders are not implemented. Inspection
returns frozen detached data and never grants capital, seals initialization or
performs retirement. Compatibility setters update the one authoritative account
and aggregate legacy net changes by category. Pending expense/income counters and
voyage profit are statistics, not additional gold holdings.

Zero port and industry defaults are deliberate: these balances did not exist
previously, and funded procurement is not active yet. They can be configured at
world initialization. Existing faction capital is neither copied to each port nor
redistributed. All initial AI vessels, including military agents, retain the
existing configured seed-wallet behavior.

## Initialization and removal

The session explicitly seals initialization after its initial density/patrol setup.
Opening total includes all accounts and pending tax receipts. Grants are recorded
once per account, including zero opening allocations. Repeated account creation
with matching identity/grant is idempotent; conflicting initialization is rejected.
Reconfiguring factories does not grant funds again. Standalone headless callers
must explicitly call `accounts.sealInitialization()` after constructing their fleet.

After sealing, positive initialization grants are rejected. Additional active AI
vessels transfer seed capital from the registered port; density/patrol allocation
skips ports unable to fund it. This is an account-lifecycle change, not shipyard
construction. A density increase can now result in fewer ships than requested.

On removal, the ship wallet and both purses transfer to its registration port,
then accounts become inactive zero-balance records. A vessel without a registration
port returns funds to its faction. Repeated removal is harmless. The existing
density reduction returns cargo to its original ports; physical/ownership changes
to that behavior are for 1C. Retired identities are not reused. Removal of a factory
returns its remaining funds to its parent port. Commitment-bearing accounts cannot
be retired. Retained grant/account records provide the lifecycle audit.

A full restart constructs a separate accounting session and fresh opening grants.
Retiring the old worker does not transfer its wealth into the replacement session.
Worker `economic-accounts` requests require the current session ID and return a
read-only financial snapshot on demand. Fleet details expose the three vessel
accounts. No full account audit is broadcast every physics step.

## Remaining legacy sources and sinks

| Active path | Present mutation | Subsequent work |
| --- | --- | --- |
| `BridgeLogistics.loadCargo` / `executePurchaseQuote` | Merchant debited; only tax has a receiving account; remainder disappears | 1B payment, 1C seller ownership, 1D revenue split |
| Unloading / `executeTransaction(...,false)` | Merchant and pending tax credited without funded buyer debit | 1B funded buyer; later Phase 2 instant settlement |
| `BridgeLogistics.bridgeTick` | Wallet charged crew and maintenance even while anchored; no recipient | 1E sea-time accrual into purses, docking settlement |
| `EconomicEngine.purchaseInfrastructure` | Faction treasury debited; no recipient; rollback restores balance | Future atomic construction payments and port investment rules |
| `InfrastructureGovernor.tick` | Dock upkeep deducted through `modifyTreasuryBalance` without recipient | Define paid upkeep recipient before claiming conservation |
| `EconomicEngine.tick` | Daily faction upkeep removed without recipient | Define treasury expenditure recipient |
| `EconomicEngine.modifyTreasuryBalance` | Public positive/negative mutation can create/remove funds | 1B explicit transfer/grant boundary |
| `EconomicEngine.tick` tax sweep | Pending port receipts move into faction treasury | Retained as transitional accounting; replace trade tax in 1D |

`EconomicAccounts.legacySet` exposes compatibility balance changes rather than
pretending they are conserved payments. `legacyMutations` is aggregate net change
since account creation; `changeSinceOpening` compares live holdings against the
sealed baseline. These have different starting boundaries if a standalone caller
mutates balances before sealing. Phase 1A does NOT provide a conserved economy.

The compatibility `LogisticsEngine` also directly creates/debits wallets and removes
vessels. It is not used by the active worker and has not been migrated. Its use is
outside the active account audit and must be removed/adapted before claiming that
all available engine implementations conserve money.

## Verification

`tests/economic-accounts.test.mjs` covers explicit initialization, configuration,
duplicate grants, separate factory owners, repeated factory configuration,
read-only inspection, authoritative wallet/faction aliases, purses, ship retirement,
funded later launches, insufficient port funds, factory retirement, rejected
reconfiguration, isolated restarts and disclosed legacy net changes.

Validation completed across all 82 test files. The broad run passed 79 files;
three fixtures were then corrected and passed on retest: the developer-setting
count now includes two capital controls, and generated fleet-growth/voyage fixtures
provide explicit opening port funds for vessels launched after initialization.
Worker integration also verifies unchanged total gold and grant count during live
density growth, and rejects stale-session account inspection. Catalog/asset checks,
startup and `git diff --check` pass.
