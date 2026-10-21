# Phase 3F: cannon and cannonball foundries

Both configured foundries are active through the existing construction, procurement, timed production, goods ownership and funded settlement services. No factory-specific economic implementation was added.

| Type | Inputs per full batch | Output | Duration | Input buffer / capacity | Output capacity |
|---|---|---|---|---|---|
| Cannon foundry | 3 iron bars | 0.25 cannons | 10 seconds | 15 / 30 iron bars | 5 cannons |
| Cannonball foundry | 1 iron bar | 2 cannonballs | 10 seconds | 5 / 10 iron bars | 40 cannonballs |

Recipes, timing, capacities, buffer targets, procurement priority/price parameters, construction materials and duration, and working-capital requests remain validated per-type configuration in `dist/data/industries.json`. Defaults remain provisional tuning. Changes apply on simulation restart, preserving accepted batch terms and factual costs.

Individual accounts, internal stores, production batches and selling offers preserve each foundry's identity. Inputs are purchased from their current owner through funded orders. Their actual acquisition cost is assigned to output, with input commodity/origin/cost provenance retained. Inputs and output space are reserved at batch start; completion atomically consumes inputs and creates output. Manufacturing moves no gold. Eligible foundry output sales use the existing manufacturing wage split once; merchant resale pays the merchant alone.

No money means procurement waits without overdraft or replenishment. Already-paid internal inputs can still be manufactured, including an accepted batch completing after the wallet is empty. Missing inputs and full output stores stop additional batches cleanly. Fractional production remains supported. Quarter-unit cannon batches accumulate into stock; merchant pickups acquire whole units only.

Cannonballs are now enabled in the commodity market, so active planning, ledgers, histories, inspection and cargo handling include them. The validated optional commodity parameter `settlement_supply_enabled` defaults to true for compatibility and is false for cannonballs. It prevents generic settlement startup stocks, consumption buffers and automatic town demand for this new commodity. Explicit inventories and funded orders remain supported. Existing cannon settlement behavior is unchanged. No shipyard, shipbuilding, new automatic output consumer or unlimited buyer was added. Foundry badges are distinct; terrain artwork still uses the existing shared ironworks tile.

## Verification

`tests/foundry-activation.test.mjs` constructs two foundries of each type at one port. Four funded accounts compete for one owner-attributed iron offer. Tests verify reservations against competing goods/fund uses, input-cost attribution, automatic seller offers, whole-unit merchant purchases from every foundry, timed loading, an unfunded remote buyer retaining cargo, and subsequent delivery after that buyer is explicitly funded by a conserved port transfer. Sale receipts preserve prices and recipient shares.

Additional checks cover empty operating accounts, full output stores, scarce fractional iron, type-isolated tuning, completion failure in a later foundry with all earlier effects rolled back, duplicate completion, authoritative simulation stepping, read-only inspection and cannonball charts. Production and transactions conserve gold exactly.

The main scenario opens with explicit grants of 6,000.00 gold to port P and 100.00 to a merchant. Port Q starts empty. Four working-capital transfers of 1,000.00 from port P fund the foundries; these are not grants.

| Closing account | Microgold | Gold |
|---|---:|---:|
| Port P | 2,080,000,000 | 2,080.00 |
| Port Q | 0 | 0.00 |
| Merchant | 76,000,000 | 76.00 |
| Cannon foundry A | 977,500,000 | 977.50 |
| Cannon foundry B | 977,500,000 | 977.50 |
| Cannonball foundry A | 994,500,000 | 994.50 |
| Cannonball foundry B | 994,500,000 | 994.50 |
| Retained faction / legacy tax accounts | 0 | 0.00 |
| Total | **6,100,000,000** | **6,100.00** |

Closing commitments and pending physical transfers are zero. Construction consumes 160 wood and 40 iron bars. Manufacturing consumes the remaining 40 bars and creates 2.5 cannons and 20 cannonballs. Sales and handling change ownership/location only. No spoilage, dumping or unexplained money changes occur.

Regression coverage includes shared manufacturing configuration, distillery/mill/ironworks activation, procurement, production, construction worker paths, selling offers, goods ownership, Phase 1/2 conservation, whole cargo, funded handling, port inspection, economic overview and default-market trading. Catalog/schema/asset validation and whitespace checks pass. Browser interaction was not verified; no graphical assets changed in this increment. There are no new settlement compatibility paths. Pricing-floor activation, forestry and shipbuilding remain separate work.
