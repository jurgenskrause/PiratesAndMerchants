# Phase 3E — textile mills and ironworks

Textile mills and ironworks are enabled alongside distilleries. All three use the same funded procurement, elapsed-time production, input reservations, output-capacity reservations, manufacturing revenue and physical handling paths. No industry-specific economic converter was added.

| Type | Full-batch inputs | Output | Duration | Input buffer / capacity | Output capacity |
|---|---|---|---|---|---|
| Distillery | 2 sugar + 0.5 wood | 1.5 rum | 10 s | Sugar 10 / 20; wood 2.5 / 5 | 30 rum |
| Textile mill | 2 cotton | 1 textile | 10 s | Cotton 10 / 20 | 20 textiles |
| Ironworks | 2 iron ore + 0.5 wood | 1 iron bar | 10 s | Ore 10 / 20; wood 2.5 / 5 | 20 bars |

All numbers remain provisional tuning in `dist/data/industries.json`. Recipes, timings, capacities, buffer targets, construction materials, construction duration, requested working capital and procurement parameters are validated separately for each type. Definitions apply on simulation restart; a started batch retains its factual terms and costs. Foundries remain inactive. Selling-price floors and autonomous expansion are later work.

Each constructed instance has its own `INDUSTRY:<encoded instance ID>` account and `INDUSTRY:<encoded instance ID>` input store. Batch output retains that account as owner and eligible manufacturing seller when moved from its output store to the local market. Two mills do not pool their money or erase their seller identities. Procurement pays the current goods owner; own allocation creates no revenue. Purchases of eligible output split proceeds once with the parent port. Paid pickups free the seller's storage but remain physically ashore and reserved for the merchant until whole units load.

Fractional inputs or available output space can produce a fractional batch, at the full configured duration. Inputs are reserved at start and consumed atomically with output creation at completion. Manufacturing changes goods, never money. Merchant acceptance and loading remain whole-unit operations; fractional goods remain identifiable until usable in a whole-unit pickup or a supported fractional local purchase.

## Supplier coverage and generation

Read-only `getIndustrySupplyDiagnostics()` distinguishes no supplier definition, no active producer, local production and required maritime imports. Primary coverage uses the active port production rates; installed, enabled manufacturers are reported as potential manufactured-input suppliers. It does not promise available stock, funded buyers or a navigable route. Port industry cards expose these diagnostics and display the instance's compiled recipe rather than a potentially different global recipe.

Cotton plantations and iron mines exist. Forestry is **not implemented**, so wood supply is finite initial/imported stock until that primary chain is added. Food/spice farms, shipyards and foundry activation are also outside this increment. A fully self-sustaining economy is not claimed.

World generation still permits at most **one starting industry per port**, with primary types only. Later material-funded construction can add multiple factories. Density and island land budgets remain upper limits. Placement now favors underrepresented primary types across the generated world, weighted by each primary definition's `placement.regional_balance_weight` (default 1; validated >0 and <=100; applied on regeneration). Terrain suitability, safe placement and isolated road rules take precedence. Small or unsuitable worlds cannot guarantee every supplier. `world.industryGeneration` records counts, missing types and ports without starting industries, including zero-density worlds. Balancing does not grant goods or money, connect port catchments, or generate extra factories to bypass the cap.

## Graphics

Built-in image generation produced distinct painterly distillery, textile mill and ironworks terrain tiles. Project assets are `dist/gfx/industries/rum_distillery-tile.png`, `textile_mill-tile.png` and `ironworks-tile.png`; primary artwork is preserved. `scripts/pack-industry-tiles.py` mechanically assembles them into the six-column `dist/industry-atlas-v3.png`. Native SVG badges remain in the existing visual style; the cannonball badge now also has a distinct frame. Dormant foundries still share the ironworks terrain frame pending their activation.

Tile dimensions are registry-driven and validated. Alpha marker 5 is exclusively a road; factory markers skip it. The terrain shader and worker/client map updates use the same mapping. Artwork and packed atlas were visually inspected. Browser interaction/WebGL rendering was not verified in this environment.

The image prompt set uses: square overhead colonial strategy terrain tile; earthy ochre yard and olive grass; hand-painted natural detail; warm upper-left light; no text, flags, people, water or borders. Subjects respectively specify a copper still and condenser with barrels/sugar/firewood; a wooden loom with cotton bales/fabric racks; and a glowing stone furnace with ore/iron bars.

## Verification

The constructed integration scenario has a distillery, **two separate textile mills** and an ironworks. It funds procurement, advances all recipes concurrently, buys textiles from both mills, completes whole-unit loading, pays factories for fractional town purchases, and allocates the town's own wood without revenue. Configuring only the mill leaves the other compiled definitions and factual production receipts unchanged. Separate scenarios cover scarce-input fractional output, unavailable suppliers and read-only inspection.

Opening grants: port P 2,000.00 gold, port Q 100.00, merchant 500.00; total **2,600.00 gold / 2,600,000,000 microgold**. Four factories receive 200.00 each through port transfers, not new grants. Closing balances:

| Account | Microgold | Gold |
|---|---:|---:|
| Port P | 1,204,250,000 | 1,204.25 |
| Port Q | 100,000,000 | 100.00 |
| Merchant | 498,000,000 | 498.00 |
| Distillery | 199,125,000 | 199.125000 |
| Textile mill A | 199,750,000 | 199.75 |
| Textile mill B | 199,750,000 | 199.75 |
| Ironworks | 199,125,000 | 199.125000 |
| Retained faction and legacy tax accounts | 0 | 0.00 |
| Total | **2,600,000,000** | **2,600.00** |

Closing commitments are zero; pickups complete and no physical transfers remain pending. Scenario tables retain six-decimal values where needed for auditing; end-user money formatting remains exactly two decimals.

Explained goods changes: construction consumes 160 wood and 40 bars. Manufacturing consumes 2 sugar, 1 wood, 4 cotton and 2 ore, producing 1.5 rum, 2 textiles and 1 bar. Purchases, local allocation and loading move ownership/location without extra goods. No spoilage, dumping, consumption or unexplained money change occurs in this scenario.

Focused suites cover activation, production/procurement, construction worker/client, graphics bounds, configuration validation, owner attribution, funded handling, whole cargo, selling offers, catchment roads, and Phase 1/2 conservation. Default market trading and the generation matrix also pass. No new compatibility settlement path was added.
