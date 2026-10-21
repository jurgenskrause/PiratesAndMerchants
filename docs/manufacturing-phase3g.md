# Phase 3G: production costing, asking prices and revenue

All five manufacturing types use one cost and pricing implementation. Production input costs, output valuations, provenance, fills and production history now carry authoritative integer `acquisitionCostUnits`. The existing `acquisitionCost` gold field is a derived compatibility view. Balances and payments remain integer microgold; no new money source, wage charge or general scarcity formula was introduced.

## Cost allocation

Purchases assign the actual paid microgold to the buyer's goods. Internal movements preserve that cost. On a partial movement, the transferred cost is `floor(original cost × moved quantity / original quantity)` using exact decimal-rational arithmetic. The remaining physical stock retains the remainder. Production provenance follows the same partition, preserving total historical cost. Compatible records still coalesce by owner, location, commodity, origin, reservation and manufacturing eligibility, so handling does not create an unbounded lot history.

Each batch snapshots its definition, input records and incurred costs when it starts. Completion allocates **each consumed input's integer cost** using the batch's normalized configured `output_cost_weights`. In configured recipe-output order, every output except the last receives its proportional cost rounded down. The final output receives that input's remainder. Output cost is the sum of its allocated input costs. Thus all output costs and their immediate-input provenance sum exactly to the batch cost. Allocation depends on configured weights, not output quantity, selling price or subsequent configuration. Output quantities remain fractional where supported.

For example, two input records costing 5 and 2 microgold, allocated roughly one-third/two-thirds, produce output costs of 1 and 6 microgold. No microgold disappears. Configuration remains validated and restart-only; existing inventory and factual history are never re-costed by changing a recipe or weight.

## Revenue-adjusted floor

For attributed cost `C`, physical quantity `Q`, and worker revenue share `s`, the conservative per-unit floor is:

`floor_microgold_per_unit = ceil(C / (Q × (1 − s)))`

It is calculated with integer/rational arithmetic and checked for safe-integer overflow. Costs at different origins within one offer use the maximum eligible pool's per-unit floor; an average across different pools cannot underprice a costly selected pool. Coalesced compatible stock uses its preserved weighted cost. Zero-cost output has a zero recovery floor; its automatic asking basis uses the commodity's existing configured baseline price.

At the provisional 25% worker share, a unit with 4.00 gold of input cost requires a floor of **5.333334 gold**, not 5.00. Selling at that floor pays 1.333333 to the parent port and leaves 4.000001 with the industry. The worker percentage is taken from total revenue once. The industry keeps the split-rounding remainder.

Actual settlement also validates that the producing industry's retained payment covers the specific sold quantity's attributed integer cost when floor enforcement is enabled. A failure occurs before any payment or ownership mutation. Local allocation of already-owned stock has no payment or wage split. Merchant deliveries and imported resale retain the existing current-owner revenue rules and do not pay the original producer again.

## Asking policy and timing

The existing validated per-type selling parameters are now active:

| Parameter | Valid range | Behavior |
|---|---|---|
| `ask_multiplier` | 0.01–100 | Automatic ask multiplier |
| `minimum_markup_fraction` | 0–10 | Minimum markup for automatic asks |
| `enforce_cost_floor` | Boolean | Reject explicit asks and actual eligible settlements below cost recovery; default true |
| `review_interval_seconds` | 0.001–31,536,000 | Elapsed-time interval for automatic ask reductions |

Automatic ask equals the recovery-floor basis multiplied by `max(ask_multiplier, 1 + minimum_markup_fraction)`, rounded upward to microgold. With no attributed cost, the baseline commodity price supplies the basis. A manual offer may choose another valid price above the enforced recovery floor; the automatic markup rule does not override it. Turning enforcement off is an explicit validated tuning choice allowing manual below-cost sales, not an alternative settlement path.

Only unaccepted offers change. New costly stock raises an enforced floor immediately; a remaining explicit offer is also raised if cost-partition rounding requires it. Automatic reductions wait for the configured review interval. Accepted prices, payments, ownership and transfer obligations remain factual. The selling clock uses the existing elapsed procurement/simulation clock, independent of snapshots or rendering. Only eligible automatic manufacturing offers are indexed for periodic reviews; unchanged frames do not scan the entire market.

Offer inspection exposes actual executable `priceUnits` / `askingPrice`, recovery `floorUnits`, and the separate proposed `policyAskUnits`. Port industry cards display current asks and floors through the two-decimal money formatter. Non-manufacturing automatic offers retain the existing pricing behavior. Unsold output stays owned and reserved in stock, counts against capacity and can halt production.

## Verification and conservation

`tests/production-pricing.test.mjs` covers revenue-share-adjusted floors, exact worker rounding, partial costs and fills, multi-output remainders, historical weights, configurable markup, below-floor rejection, explicit enforcement opt-out, timed reductions/immediate floor increases, locked accepted pickups, imported resale, injected settlement rollback, tiny movements, large-price history and integer overflow. Existing configuration validation covers parameter limits. Manufacturing, foundry, ownership, goods indexing, funded markets/handling, revenue distribution, microgold, port UI and Phase 1/2 conservation regressions pass; default trading also passes.

The updated four-foundry integrated scenario opens and closes with **6,100,000,000 microgold**. Cannons sell at the 32.00 gold recovery floor, while cannonballs sell at 3.00. Those purchases pay 76.00 total: 57.00 to the four sellers and 19.00 in worker income. The sold goods have 52.00 of attributed input costs. Subsequent merchant delivery to a funded remote port pays only the merchant.

| Closing account | Microgold | Gold |
|---|---:|---:|
| Port P | 2,091,000,000 | 2,091.00 |
| Port Q | 0 | 0.00 |
| Merchant | 32,000,000 | 32.00 |
| Cannon foundry A | 994,000,000 | 994.00 |
| Cannon foundry B | 994,000,000 | 994.00 |
| Cannonball foundry A | 994,500,000 | 994.50 |
| Cannonball foundry B | 994,500,000 | 994.50 |
| Retained faction / legacy tax accounts | 0 | 0.00 |
| Total | **6,100,000,000** | **6,100.00** |

Commitments and pending transfers close at zero. Construction consumes 160 wood and 40 bars. Manufacturing consumes 40 more bars and creates 2.5 cannons plus 20 cannonballs, carrying all 80.00 of paid input costs into output. Transfers do not create goods or money. No unexplained gold changes occur. Phase 3F's previous documented below-cost scenario predates this pricing activation.

No additional settlement compatibility path was introduced. Gold cost fields remain derived read-only compatibility views. Price floors can leave factories unable to sell at available bids; that is a funded market outcome, not an automatic buyer or replenishment trigger. Browser interaction was not verified in this environment. Forestry, autonomous expansion and shipbuilding remain separate work.
