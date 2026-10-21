# Interphase 1F–1I: upkeep removal and exact money

Harbor and faction upkeep are no longer simulated. Dock/settlement catalogs and schema no longer expose daily upkeep. Old upkeep seeds are ignored; calendar advancement cannot deduct treasury funds for upkeep. Governor congestion review and construction remain active. Sailors’ pay and hull maintenance remain funded sea-time purse transfers, settled once at the next authoritative docking. No second dockside amenities charge is introduced.

## Monetary contract

Balances, commitments, initialization grants, payments and recipient shares are nonnegative safe integer microgold: 1 gold = 1,000,000 units. Total account wealth must also fit `Number.MAX_SAFE_INTEGER` units. Overflow is rejected before mutation. The mathematical maximum is 9,007,199,254.740991 gold; decimal gold imports near that limit may be rejected if floating-point conversion rounds outside the safe range. Existing public gold fields are derived read-only compatibility values, never separate balances.

Gold configuration and public boundary inputs round once to the nearest microgold. Payment callers may pass exact `amountUnits`. Prices are quantized to microgold; affordability and settlement compare exact integer units. Explicit initialization records the quantized grant and seals an opening total. A full restart creates a new session; no recurring grant or replenishment is added. This app does not persist live account sessions across reloads, so no saved-money conversion is necessary.

Fractional sea-time accrual is carried separately for crew pay and hull maintenance until whole microgold is payable, including across intermediate dockings. Rate definitions retain fractional fidelity. Tiny floating-point near-integer accumulation errors are normalized within 32 scaled machine epsilons, capped at 0.0000001 microgold; fractional accumulators are not balance accounts. Underfunding allocates available units proportionally, floors sailors’ share and gives the remainder to maintenance, clamped to each component’s due amount. Unfunded whole units are diagnostics, never payable balances or arrears. Ship purse money remains in conservation totals and is swept on retirement.

Manufacturing worker income is floored to whole microgold. Industry retention receives the rounding remainder (and at least one unit for a nonzero eligible sale). Per-seller attribution divides a combined sale without changing total payment units; the last seller receives any remaining sale-attribution rounding. Existing 25% worker share remains provisional tuning.

## Presentation and compatibility

`dist/money.js` supplies one formatter for all monetary prices, profit, wallet/purse labels, history, graphs and configuration displays: exactly two decimals, with negative zero suppressed. Display values never feed affordability. Untouched configuration inputs preserve the original precise setting when submitted, despite rounded presentation. Exported developer JSON retains numeric units for diagnosis rather than converting them to display strings.

Legacy bound balance writes and `legacySet` accept only unchanged microgold values. `modifyTreasuryBalance` rejects nonzero adjustments. Funded transfers must use the payment service. Exact-unit fields appear alongside derived gold values in read-only snapshots, receipts and histories.

## Material-only construction and completion

Construction has no separate gold charge. Town, dock and industry catalog build costs contain materials only, and catalog validation rejects gold as a construction commodity. Compatibility `purchaseInfrastructure` ignores a legacy `gold` field. The former construction-expense sink API has been removed.

A port consumes its own unreserved market materials without a payment to itself. Materials belonging to an industry or merchant must first be purchased through funded settlement; construction cannot consume another owner's stock, town consumption supplies or reserved materials. Material deductions and placement retain rollback and publish no partial market event on failure. Existing construction timing is unchanged.

Retained faction accounts keep all existing funds. Neither faction nor port wealth gates construction when owned materials suffice. Material purchases retain the existing primary-owner and manufactured-worker revenue rules.

The integrated scenario now includes construction, reconciles its wood consumption, and conserves exactly 3,707,000,000 units (3,707.00 gold opening and closing). Removed upkeep, blocked arbitrary setters and material-only construction leave no identified monetary sink in the audited active Phase 1 paths. Future production chains and purchase-order behavior remain later phases.

## Whole-unit cargo pickups

Merchant market pickups acquire only whole units. Requested quantities, available unreserved stock, hold space and affordable volume round down. The economic settlement enforces this for ship stores as well as both logistics APIs. Loading carries fractional handling progress until a complete unit can be moved; planning and purchase locks use whole quantities. A merchant unable to load one unit exits loading without buying a fraction. Manufacturing inputs, local allocations and deliveries retain fractional quantities so existing conversions and damaged cargo can clear normally.
