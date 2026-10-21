# Phase 1: data-driven game definitions

Game startup loads the JSON catalogs in `dist/data/` before consumers execute. Browser and worker adapters use fetch; headless Node tests use filesystem reads. A failed load, schema violation, duplicate identifier or broken cross-reference prevents activation of the entire catalog set. There is no partially loaded registry or silent faction naming fallback.

## Catalogs

| File | Responsibility |
| --- | --- |
| commodities.json | Names, prices and spoilage rates |
| vessels.json | Roles, berth requirements, hull points, dimensions, crew limits, upkeep, sailing tuning, upgrade ceilings, mast and sail sprite metadata |
| industries.json | Input/output matrices, construction cost, terrain constraints and placement rules |
| factions.json | Runtime aliases, visual identity, bright pennant color, flag references, initial standings and naming banks |
| naming.json | Faction-specific captain, governor, port, island and military/merchant ship names |
| settlements.json | Port eligibility, stockpile defaults, tax, consumption, treasury and graphic references |
| assets.json | Renderer-independent asset identifiers and paths |
| settings.json | Global wages, simulation timing and map-scaled economic settings |

`catalog.schema.json` uses Draft-07 type, required, additionalProperties, enum, numeric bounds, array items/minItems and string pattern/minLength keywords. The dependency-free validator implements those keywords, rather than claiming support for the entire JSON Schema specification. New schema features require matching validator support. Cross-reference validation adds relationship and compatibility checks beyond the schema.

Definitions are deeply immutable. Registries resolve records by ID; registration rejects duplicate IDs and validates against the corresponding item schema. Definitions contain no Pixi texture or renderer objects. Asset loading remains injected, shares concurrent promises and retries after failures. Boot-time JSON reads have no per-tick cost.

## Compatibility and naming

Existing runtime commodity/class/faction identifiers remain stable. Existing ship tuning, sail stages, purchased upgrade defaults and atlas layouts are preserved. The canonical ship fields and legacy physics projections are checked for consistency. ExtraLarge capital classes retain whole-pier mooring; existing hull-safety checks may still promote any unsafe side berth to the pier end.

Ports use only the faction's assigned prefix/root bank and preserve seeded unique chart names, adding Roman numerals after exhaustion. Captain, governor, island and ship naming is deterministic from world seed and entity identity, with separate military/merchant banks. Unknown faction or category is an error. Ship snapshots and tooltips include ship and captain names. Each port keeps its own governor name, and islands carry faction/name metadata.

The old `port-names.json` remains as a legacy fixture for regression tests; runtime generation does not fetch or use it as an authority. Its former definitions now live in the faction/naming catalogs.

## Configurable manufacturing

Primary extraction industries continue to generate with the same terrain, spacing and port reservation rules; their outputs feed production rates from the catalog. The registered secondary recipes are textile mills, ironworks, rum distilleries and cannon foundries. Their world-placement flags default to disabled, so this infrastructure phase does not silently change the generated economic balance or pretend that new building artwork exists.

A secondary world industry record with `type` and `portId` creates a manufacturing instance automatically through `createPortEconomy`. Headless clients can pass `industries: [{port_id, industry_id, count}]` to EconomicEngine or atomically replace the instance list with `configureIndustries`. This is configuration infrastructure, not a player construction UI. Construction cost/terrain requirements are available for the later construction system.

Every economic tick preflights factory processing with the rest of production. Factories consume unreserved trade stock only, never consumption stock. Insufficient inputs scale a batch proportionally; missing inputs halt output. Outputs enter trade stocks and flow through existing price recalculation and market events. Factories execute in stable configured order, so competing recipes are deterministic. Invalid reconfiguration leaves the prior list active. Aggregate count permits many identical factories without one object per production unit.

Industry artwork currently uses existing atlas frames. Secondary recipes have an explicit fallback frame and remain unplaced by default. Adding a new atlas layout or a new building visual still requires the renderer to support that layout; replacing an asset URL or ship frame metadata does not.

## Checks

Run `node scripts/validate-data.mjs` to validate catalogs, references and asset files. Run `node tests/phase1.test.mjs` for schema rejection, naming, seeded generation, compatibility and manufacturing checks. Existing fleet, economic, market/ledger, traffic, patrol and docking suites remain applicable.
