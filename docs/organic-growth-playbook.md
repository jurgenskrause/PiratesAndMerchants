# Organic growth: implementation playbook

Status: design proposal for review. This document changes no gameplay code.

## Agreed opening rules

1. Generate geography, count islands, then validate actual colony sites, docks, industry terrain, and conflict-free assignments. On the world-generation screen, offer a faction-selector interface inspired by Age of Kings: select which **two or three national factions** participate from British, Spanish, and French, plus an independent **Enable pirates** toggle. This selects participants, not a player-controlled faction. If the selection is unsupported, disable Start and explain why. If even two nationals are unsupported, warn: “These map settings cannot support two national factions and a viable economy. Generate more suitable islands or choose a larger map.” Pirates never satisfy the two-national minimum.
2. One colony per island globally. Each national faction claims two distinct islands: one crown colony and one small colony. Pirates, if enabled, claim two distinct islands for two small colonies; they have their own fleet and AI rules, and do not get a Man-of-War.
3. At tick zero, national crown colonies start with a **Large Deep-Water Dock**, one Man-of-War (`FIRST_RATE`), two mid-range merchants, and one industry. National small colonies start with a **Small Dock**, one mid-range merchant, and one industry. An initial fleet default can use a Brigantine and a Schooner at the crown, plus a Schooner at the small colony; all three meet the existing dock-size rules. Each pirate small colony starts with a **Small Dock**, one pirate-only Corsair that can use it, and one industry. Founding, industry activation, and ship creation happen in one attributable opening transaction, with no separate settlement voyage.
4. Colony selection uses a seeded randomized order of **all participating factions, including pirates**, followed by its reverse: `P1, P2, P3, P3, P2, P1` for three participants. Nations select crown islands on their first turn and small-colony islands on their second; pirates select small-colony islands on both turns. AI makes every pick for this release. At each turn, reject choices that would leave no valid completion of the draft or the required-industry coverage.
5. The normal game derives initial ship counts from colonies and later shipbuilding. Remove the global merchant-number target and automatic military-patrol quota from normal play. Large vessels may anchor offshore near a friendly small dock to replenish water and use that colony as a patrol waypoint; they cannot berth, load, unload, repair, or build ships there merely because they can anchor. The fixed world-generation and 50-merchant simulation benchmarks retain their current separate startup and measurement paths.
6. A player-controlled faction is **out of scope for this release**. The user selects participating factions at world generation; AI chooses islands, industries, investments, and orders for all of them. Full manual faction control remains a later feature.
7. Colonies can eventually develop a shipyard when their population, materials, money, and dock access qualify. Shipyard tiers correspond to the sizes of vessels they can construct. New shipyard graphics and tier visuals are a deliverable of that later slice.
8. Starting industries are chosen from a finite list of **required economic foundations**. When an AI faction chooses one, remove it from the outstanding required list. Confirm coverage across all founded colonies before Start. On larger worlds, remaining slots may offer duplicates or optional industries, with a finite number of choices and terrain constraints.
9. All opening rules and tunable amounts use the **base game configuration engine**: faction selection, pirate toggle, starting ship counts/types, colony/dock roles, industry requirements, seed resources, shipyard thresholds, and anchorage/water tuning. A versioned world configuration snapshot determines both generation and simulation. Benchmark mode retains its fixed profile and does not inherit normal-play opening changes.
10. Ship-to-ship combat, pirate attack/loot orders, and damage are **out of scope** for this version. The Corsair has pirate-only eligibility, suitable vessel properties, and art, but its weapons do not imply functional combat yet.

## What the current repository supports

- `dist/generator.worker.js` currently calls `generatePorts` and `generateIndustries`, prebuilding ports and industries on eligible islands. `dist/ports.js` can place extra ports on one island; this must be gated or replaced by the one-colony rule. `dist/colony-presets.js` supplies settlement footprints.
- `dist/merchant-session.js` currently spawns to a global density and adds military ships by merchant-count quotas. Normal play needs explicit per-colony funded ships; the benchmark needs its unchanged path.
- The catalog has exactly **two dock types**: `small_pier` / “Small Dock” has **Medium** maximum berth size, nominal capacity for two ships, one water tile of pier, and 25 Wood build cost; `deep_water_quay` / “Large Deep-Water Dock” has **ExtraLarge** maximum berth size, nominal capacity for three ships, two water tiles of pier, and 100 Wood plus 40 Iron Bars build cost. Both declare minimum water depth 0.01 for footprint placement, but actual hull draft, safe mooring slot, approach, turning, and departure still gate each vessel. Schooner and Brigantine both require Medium and can use a Small Dock. Sloop requires Small and can also use it. Fluyt and Frigate require Large, so they cannot berth at a Small Dock. War Galleon and Man-of-War require ExtraLarge and have a two-berth class requirement, but the current large-vessel pier-end reservation occupies **all three large-dock slots** while moored. The Man-of-War has draft 5.5, which makes a safe crown harbor more restrictive than the dock footprint alone.
- There is no dedicated heavily armed merchant class. Add a pirate-only **Corsair** (working name; “Privateer” is an alternative) with no more than Medium berth requirement, safe shallow-water draft, middling cargo, and credible future armament. One starts at each pirate colony and must pass the same Small Dock compatibility and safety checks as other vessels. `dist/logistics.js` has an interdiction/incident hook but explicitly leaves weapon and damage rules for a later layer. Do not describe the Corsair as able to attack in this release.
- `dist/ship-provisions.js` already refills drinking water for a friendly ship with an anchor reservation at a port; `DockTraffic.previewAnchor` can find an offshore position without a compatible berth. But `bridge-logistics.js` patrol visits use `canVisit`/`canDock`, so they currently exclude undersized ports. Add an explicit anchor-only patrol visit distinct from docking and cargo service; require safe depth, clear turning, permission, and a live anchor reservation. It is a water stop and waypoint, not a backdoor dock.
- Active industry types are cotton, iron ore, sugar, rum distillery, textile mill, ironworks, cannon foundry, and cannonball foundry. **Forestry/renewable wood does not exist**; existing wood is finite starter/imported stock. Shipyards and ship construction are also not implemented. Existing documentation anticipates wood, iron bars, cannons, cannonballs, and textiles for ship construction. Sugar is only a recipe input for rum, although town consumption rules currently cover it like other settlement goods.
- Existing Schooner and Brigantine five-frame ship atlases are present, as are the current industry atlas and some industry art. No Corsair or shipyard assets exist. Rum distillery, textile mill, and ironworks have distinct tile art; both foundries currently reuse the ironworks atlas frame. The new sawmill, Corsair, shipyard tiers, and distinct foundry art must be produced and integrated as explicit assets, not left as placeholder references.
- `dist/economy.js` has faction accounts, but opening port and factory grants are separate. Initial colonies, ships, and starter stock need explicitly funded, conserved sources; don't accidentally grant the same capital twice.
- `dist/configuration-registry.js` and `dist/compiled-configuration.js` own validated world settings and snapshots. Current definition types are number, integer, and boolean; vessel/dock class selections and an arbitrary set of faction IDs need either explicit validated enum/list support or a fixed catalog mapping plus per-faction boolean settings. Do not store hidden startup knobs only in UI state. Update source catalog/config definitions and the generated bundle together.
- The README names tests whose files are absent in this checkout. Add focused checks or locate the external suite before claiming its tests pass.

## Required opening industry list: proposal

| Priority | Industry | Output | Reason |
| --- | --- | --- | --- |
| Required | Forest sawmill (new) | Wood | Renewable material for construction and later factories; must be on suitable forest terrain. |
| Required | Iron mine | Iron ore | Source for ironworks and metal chain. |
| Required | Cotton plantation | Cotton | Source for textiles in ship construction. |
| Optional early | Sugar plantation | Sugar | Supplies rum and ongoing sugar demand; not needed to bootstrap the metal/textile/shipyard chain. |

Use the forest biome as the raw resource and one sawmill industry as its extractor/processor. It produces the existing `WOOD` commodity, conceptually usable lumber/planks. Do not let a sawmill generate wood on treeless terrain. A later, deeper forestry simulation could add separate logs, plank recipes, depletion, and regrowth; that would add another required industry slot and change existing construction recipes.

The three required types are a **foundation**, not every factory. Sugar is optional at tick zero: without it, rum production eventually stops and sugar demand remains unsupplied once starter stock runs out, but iron, textiles, and shipyard inputs can still grow. Later ironworks, textile mills, cannon and cannonball foundries must be buildable from these outputs and a finite, recorded starter reserve of iron bars and other construction materials. The current ironworks itself costs iron bars to build, so without a reserve or a changed recipe the metal chain cannot start. A two-national start has four starter slots, leaving one optional/duplicate choice; three nationals have six, and enabled pirates add two. The current eight types plus the proposed sawmill would make nine; requiring *every* industry at tick zero conflicts with one industry per colony.

The generation UI should show the selected participants, map feasibility, and the outstanding required industry types. During the automated snake draft, each faction chooses from finite legal site/industry options; remove a required type from the outstanding list after its first successful placement. Before each turn, check that remaining islands and turns can still cover the rest. If a pick makes coverage impossible, discard it with a reason rather than discovering failure after the last turn. Pirates may contribute a required industry when enabled, but national economic viability must not depend on enabling pirates.

## Implementation slices

### A. Geography and startup feasibility

Create deterministic legal-island candidates, including crown capital-ship access, national small-colony Medium starter-ship berth at the existing Small Dock, pirate Corsair berth at a Small Dock, large-ship offshore anchorage, suitable industry sites, roads, and one-colony-per-island reservations. Compute whether the configured national factions (plus optional pirate pair) can be placed with full foundational industry coverage. The integer island count is an early filter, not the final feasibility test. Add participating national identities and a pirate toggle to the world-generation screen, backed by validated world configuration.

**Done when:** Repeated seeds yield identical eligibility and explanations. Two nationals require four conflict-free islands; three require six; pirates add two. Unsupported selections disable Start. No selected crown traps its Man-of-War. Low-island maps show the agreed warning.

### B. Snake draft and industry selection

Seed a random permutation of all participating factions, including pirates, run the first round forward and second round backward, and reserve each selected island immediately. A national faction seeks a crown site in round one and a small site in round two; the pirate faction seeks a small site in both. AI scores options using island resources, trade access, safe berths, and the outstanding industry list. Each pick includes the industry, dock site, affordability, and a look-ahead feasibility check. All starts in this release are playerless simulations after the world-generation choices.

**Done when:** Draft order reverses exactly with pirates in the same loop, one colony per island is preserved, national and pirate port roles are correct, and the final required-industry list is empty. An impossible candidate is rejected before its turn completes; a dead-end draft can be rolled back or replanned deterministically.

### C. Corsair vessel art and registration

Create an original transparent top-down Corsair atlas with the existing five sail states, consistent hull alignment, style, frame anchors, and pennant handling. Add any ship portrait/icon the UI needs. Register the pirate-only class in the vessel and asset catalogs, pack/source it through the same repeatable art pipeline as existing vessels, and validate load, scale, heading, collision bounds, wake, and faction restriction. This ship is designed for future combat, while the current release uses only supported navigation and trading mechanics.

**Done when:** Every pirate starter has one visible Corsair that safely docks at its Small Dock and sails normally. No national faction can create or use this class. All five frames and UI icons resolve to delivered assets; no missing art, borrowed ship atlas, or undefined combat behavior is presented.

### D. Tick-zero funding and fleet

At tick zero, make opening foundation, starter industry, stocks, dock, vessels, and account movements a single idempotent, rollback-safe transaction using the compiled configuration snapshot. A national crown spawns one safe Man-of-War, two mid-range merchants, and a Large Deep-Water Dock; its small colony spawns one Medium-class merchant and a Small Dock. Each pirate colony spawns exactly one Corsair and a Small Dock. The current pier-end rule gives a moored Man-of-War exclusive use of **all three large-dock slots**, so the crown merchants must begin at safe, separately reserved offshore anchorages if the capital ship is moored. Validate berth capacity, anchor clearance, and class compatibility. Explicitly separate normal startup from fixed benchmark startup.

**Done when:** Ledgers conserve gold and goods, no ship spawns in unsafe water or at an undersized berth, and restart produces no duplicates. Normal fleets derive from colonies; benchmark reports still use the same 50 merchants, seeds, scenes, and duration.

### E. Anchor-only water and patrol waypoints

Preserve existing friendly-anchor water refill. Permit a large ship to select a small-colony waypoint for patrol or water without requiring `canDock`, using the existing safe-anchorage search and reservations. Keep cargo purchase/sale, shipbuilding, repairs, and docked-only handling behind berth checks. Validate hostile access and safe departure; never route a deep-draft vessel through shallows just because the small dock is close to shore.

**Done when:** A Man-of-War can anchor at a friendly small port, refill water, and continue patrol; it cannot dock or transfer cargo there. A blocked/unsafe anchor is skipped safely, and hostile ports are not treated as friendly water stops.

### F. Economy-first growth and industry art

Add the forest-dependent sawmill, seed enough finite material to bootstrap ironworks, and prove the production chain can reach textiles, cannon inputs, and later shipyard construction under funded trade. All participating factions remain AI controlled in this release. Sugar shortages may be visible and eventually motivate later sugar investment; they should not stop unrelated production or trade.

Create new sawmill terrain art, its icon, and any required production/overview marker. Audit existing industry art and replace shared placeholder frames for the cannon and cannonball foundries with distinct tile art and icons. Repack the industry atlas, update source asset/industry catalogs and the generated catalog bundle, and check atlas frame indices, transparency, visual style, close-view legibility, and overview markers. Include original source assets and provenance/prompt notes so future atlas rebuilds are repeatable.

**Done when:** A deterministic two-national game with pirates off can grow beyond its initial stock without creating free money or goods. A game with pirates uses the same faction-count rule and snake draft. Sugar-free openings still run the core economy, while rum correctly waits for supply. AI nations continue functioning. Sawmill and foundries have final, correctly mapped artwork rather than silent frame reuse.

### G. Shipyards and later ships

Define shipyard building costs, population/resource gates, construction time, and ship-size tiers. Ship orders commit funds/materials, select a compatible berth, and produce a vessel on completion rather than changing a global merchant target. Generate and integrate shipyard artwork for each visually distinct tier, retaining the established terrain style and atlas pipeline.

Create original tile art and an icon for each visually distinct shipyard tier, plus any construction-state visual needed to show an unfinished yard. Pack and register frames, add the catalog definitions and renderer mappings, and verify each tier at close and overview zoom. Keep source artwork and generation/packing instructions in the repository.

**Done when:** A colony can fund and finish the right tier, build a compatible ship, reject a too-large ship or unavailable materials, and show the tier correctly at close and overview zoom. Repeated orders and restart do not duplicate ships or costs.


## Verification and rollout

Add seeded checks at 32, 128, and 512 hexes, including unsupported faction counts, pirates on/off, impossible draft orders, required-industry coverage, Corsairs and Medium starter merchants at Small Docks, safe crown berth availability, large-ship anchor-only water and patrol visits, no cargo service at anchor, tick-zero conservation, later sawmill/manufacturing, asset loading and atlas frames, and playerless simulation. Verify world configuration validation, snapshot/restart behavior, and rejection of invalid combinations. Audit all normal fleet spawners so density and patrol quotas cannot create unbudgeted ships. Keep the existing benchmark scenario fixed and compare its outputs before and after. Review each implementation slice in a PR; mark the feature complete after the relevant slices merge.

## Decisions still needed

1. Confirm **Corsair** as the pirate-only class name. It can use the existing Small Dock with either a Small or Medium berth requirement; the actual draft and storage must be tuned and tested.
2. Confirm the proposed national starter mix: Brigantine and Schooner at each crown, Schooner at each small colony. All can use the existing dock types, subject to site-specific safety.
3. Confirm the sawmill-on-forest → existing `WOOD` commodity as the first renewable wood design. Should Sugar remain optional at tick zero, with rum and sugar demand waiting until a plantation is founded later?
