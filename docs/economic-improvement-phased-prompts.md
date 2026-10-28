# Economic Improvement: phased developer prompts

**Update:** Economic Improvement

**Integration branch:** `feature/economic-improvement`

**Source design:** [Organic growth playbook](organic-growth-playbook.md)
**Status:** implementation prompts; no gameplay implementation is claimed by this document.

## Delivery contract for the whole update

Use one reviewable phase PR per top-level phase, targeting `feature/economic-improvement`. A phase is complete after its acceptance checks pass and its PR merges into that branch. The update is complete only after the integration PR merges into `main`. Keep the integration branch buildable after each phase. Make new behavior opt-in behind a validated world configuration/profile until the complete normal start works. Do not change the fixed world-generation and 50-merchant simulation benchmark recipes; explicitly route benchmark startup through its existing profile. Remove the normal-play merchant count only after the new funded fleet path works.

The currently agreed rules are: two or three selected national factions (British, Spanish, French), optional Pirates who do not count toward the two-national minimum, two islands per faction and at most one colony per island, all-AI snake selection in forward then reverse seeded order including Pirates, national crown plus small colonies, Pirate two small colonies, one starter industry per colony, and tick-zero funding/founding. Each national crown has a Large Deep-Water Dock, Man-of-War, Brigantine, and Schooner; each national small colony has a Small Dock and Schooner. Each Pirate small colony has a Small Dock and one pirate-only Corsair. The exact national merchant mix and Corsair name remain proposed defaults, exposed through validated configuration as appropriate. Combat and player-run faction controls are outside this update. Shipyards and later funded vessel construction are in scope.

The dock catalog has two types: `small_pier` accepts up to Medium ships, nominally two; `deep_water_quay` accepts up to ExtraLarge, nominally three. Actual safe berth, depth, approach, and departure checks still apply. A moored Man-of-War reserves the full large pier in current traffic rules, so other crown ships need safe initial anchorages. Large ships can replenish water at friendly offshore anchorages near small ports, but cannot berth or exchange cargo there. Refer to the playbook for the complete repository audit.

For every phase: state the base commit and configuration revision, preserve deterministic seeds, add only focused tests that exercise behavior rather than mirroring implementation, run available relevant checks, and report successes, failures, and limitations. The README names tests absent from this checkout; locate their real source or add focused local checks before claiming any named suite passed. Profile or benchmark only the subsystem changed. Report normal-mode generation/worker costs and any regression in the fixed benchmark separately. Do not require the user to run dozens of manual benchmarks for each phase.

## Phase 0: Baseline, branch, and executable checks

**Purpose:** Give every later phase a safe integration target and observable baseline.

### 0.1 Repository and test inventory

Identify the actual source catalog files, generated `dist/data/catalog-bundle.js`, asset packing process, current world/worker startup routes, and the missing README test files. Add a small runnable check harness or document the external suite and retrieval path. Ensure the branch builds and serves before feature work begins.

### 0.2 Fixed reference scenarios

Record seeded 32, 128, and 512 maps, each with island counts, eligible harbor sites, generated port/industry counts, generation and worker setup time, and memory where available. Record the existing fixed simulation benchmark output on one target browser, plus the exact seed, resolution, viewport, fleet, and duration. Keep these reports in `docs/economic-improvement/` without changing benchmark code merely to chase a metric.

**Developer prompt:** Prepare the `feature/economic-improvement` integration branch and a repeatable baseline. Inventory code and art sources; establish focused automated checks for world generation, money/goods conservation, dock safety, ship start, and benchmark routing. Record actual commands, environment, and known missing tests. Avoid claiming the new economy works yet.

**Done when:** Baseline artifacts, test commands, and a clean build are reviewable; every later phase can compare against them. No changed gameplay or benchmark recipe.

## Phase 1: Versioned opening configuration

**Purpose:** Centralize settings before generation, UI, and simulation use them.

### 1.1 Schema and catalog

Extend source `configuration_definitions.json`, schema and generated bundle through the repository's canonical generation path. Include per-national enabled flags, Pirate toggle, initial colony/fleet counts and class choices, required-industry policy, bootstrap supplies/treasury, shipyard thresholds, and anchorage tuning. Current configuration types are number, integer, and boolean; use boolean flags for fixed participating factions, and add validated enum/string support only where class selection genuinely needs it. Reject invalid combinations and unknown identifiers. Do not maintain duplicate hardcoded copies in UI and worker.

### 1.2 Compile, snapshot, route

Compile the new world-scoped opening section in `dist/compiled-configuration.js`. Pass the same immutable revisioned snapshot through generation and simulation. Keep an explicit `legacy_benchmark` or equivalent scenario route that consumes its fixed prior settings. Define restart/regeneration behavior and compatibility for older snapshots.

**Developer prompt:** Implement the authoritative Economic Improvement configuration contract in the base engine. Make source data, validation, compile path, UI bindings, worker messages, and benchmark isolation agree. Add rejection checks for fewer than two enabled nationals, unsupported ship/dock pairings, negative costs, impossible caps, and stale revisions. A map-specific feasibility failure belongs to Phase 3, not static validation.

**Done when:** Round-tripping a world snapshot preserves all opening choices; invalid values fail with useful diagnostics; benchmark mode still receives its fixed profile. No normal opening is switched on prematurely.

## Phase 2: Renewable wood and foundational industries

**Purpose:** Make the required industry list real before a planner promises it can place it.

### 2.1 Forest sawmill

Add a single sawmill industry placed on suitable forest land, producing the existing `WOOD` commodity. The forest is the input resource; do not add a separate Logs or Planks commodity in this update. Apply the existing placement, road reachability, production, ownership, market, and funded construction rules. Define a finite, explicit opening material grant, including enough Iron Bars to bootstrap the first ironworks, which currently requires bars to build itself.

### 2.2 Industry art and catalog validation

Create original sawmill terrain artwork and icon, plus distinct cannon and cannonball foundry tiles rather than relying on the shared ironworks frame. Include source art, prompt/provenance notes, reproducible atlas packing, catalog/asset references, and visual checks at building and overview scale. Validate that every referenced frame loads. Existing Cotton, Iron, and Sugar visuals may remain if their mapping is correct.

**Developer prompt:** Implement and render a forest-dependent sawmill that renewably outputs `WOOD`, then make the starting foundation list `sawmill`, `iron`, and `cotton`. Keep Sugar an optional opening choice: its absence may starve rum and Sugar demand, but cannot prevent the metal/textile/shipyard chain. Give all three required types usable terrain and road eligibility. Seed construction material via recorded initialization, not recurring free goods. Produce the sawmill and foundry art as real assets, register it, and verify render frames.

**Done when:** Each required industry can be placed on legal terrain, operate and sell under existing economy rules; forest-free sawmills are rejected; inventory sources reconcile; art loads without placeholder reuse. A minimal two-national map is not required to host every later factory at tick zero.

## Phase 3: Feasible islands and faction capacity

**Purpose:** Prevent invalid draft options and impossible starts.

### 3.1 Site enumeration

Extract deterministic candidate checks from `dist/ports.js`, `dist/colony-presets.js`, `dist/industries.js`, and dock/road validators. Evaluate whole-island exclusivity; crown town footprint and `deep_water_quay`; Man-of-War draft, mooring, turning, and safe departure; Small Dock for Schooner/Brigantine and Corsair; one legal industry per site; and compatible sea routes. Use shared terrain/world identifiers rather than duplicating world state.

### 3.2 Capacity solver and diagnostics

Count raw islands first, then solve a conflict-free assignment of two islands for each selected national and two more if Pirates are enabled, while leaving enough sites for SawMill/Wood, Iron Ore, and Cotton coverage. Do not use `floor(islands/2)` as the sole viability result. Return stable rejection reasons per faction/role/island and a bounded search budget at 512. Disable Start if the selected faction set cannot be fully assigned. If even two nationals are impossible, show: “These map settings cannot support two national factions and a viable economy. Generate more suitable islands or choose a larger map.”

**Developer prompt:** Build a seeded, bounded candidate enumerator and feasibility solver as a focused module. Analyze available islands before any settlement is created. Confirm that at least two mutually trading national factions can each obtain a crown and small island, the optional Pirate pair can also fit, and all three required foundational industries have a legal placement. Preserve the one-colony-per-island invariant. Give the generation UI concrete capacity and terrain reasons rather than a count-only warning.

**Done when:** Fixed seeds produce the same candidate list and feasible faction counts. An unsatisfiable two-national selection cannot start; a valid matching is found even where a greedy island choice would dead-end. Tiny/sparse map results are actionable, and 512-map analysis remains bounded and measured.

## Phase 4: Snake draft and generation screen

**Purpose:** Turn the feasible candidates into a transparent opening plan.

### 4.1 Draft engine

Create a pure seeded permutation of enabled national factions plus optional Pirates. Execute one forward pass and one reverse pass. Nationals select crown sites in pass one and small sites in pass two; Pirates select small sites both times. Reserve an island on each pick, choose one legal industry for that colony, and remove its type from the outstanding required list on first placement. At every pick, look ahead to ensure the remaining roles and industries still fit; use deterministic backtracking if needed. Store a plan with reason codes, costs, island IDs, and configuration revision.

### 4.2 Age-of-Kings-style selection UI

On the world-generation screen, present British, Spanish, French participation, a Pirate toggle, map capacity, and selected faction badges. This selects participants, not a human-controlled faction. After generation show or animate the AI draft order and choices, allow review, and start the playerless simulation only with a fully valid plan. Regeneration and config changes invalidate the plan. Keep the benchmark buttons direct and independent.

**Developer prompt:** Implement the configured participant selector and AI snake draft using the Phase 3 solver, including Pirates in the same loop. Avoid two colonies on one island and never consume an industry choice that makes the required list impossible to complete. Bind Start to a validated plan tied to the current world/configuration snapshot. Make the status and reason for any disabled Start button understandable.

**Done when:** Three participants follow `P1,P2,P3,P3,P2,P1` for a seeded order, with correct Pirate roles; island and required-industry invariants hold; selection/restart is deterministic; benchmarks still launch without the new chooser.

## Phase 5: Corsair class and complete vessel assets

**Purpose:** Make the Pirate starter vessel a first-class ship before fleets are founded.

### 5.1 Class and ownership

Add a pirate-only Corsair to the source vessel and asset catalogs. Tune safe draft, up-to-Medium berth requirement, middling cargo, crew, endurance, running cost, sailing physics, and future armament fields. Permit normal navigation and Pirate-to-Pirate funded trade as supported; do not add attack, loot, damage, or a claim that combat works. Enforce Pirate-only creation in authoritative worker-side commands.

### 5.2 Art and rendering

Generate an original transparent top-down Corsair five-state sail atlas, matching existing ship alignment, style, anchors, scale, pennants, and wake. Add any fleet/inspector icon. Keep source artwork and repeatable packing metadata. Register and load all assets through the existing catalog; no borrowed Brigantine frame or missing-art fallback.

**Developer prompt:** Deliver a playable, visible Corsair with its final asset set. In an isolated seeded fixture, ensure it can berth at the existing Small Dock on a validated site, and reject its creation for a national faction. Keep combat out of scope and label its current role as a Pirate trading/patrol vessel designed for future combat. Verify all sail frames, collision bounds, docking, water endurance, and restart rendering. Phase 6 will integrate the class into the opening fleet.

**Done when:** A fixture Pirate Corsair can be created, sailed, and docked safely at a Small Dock; no invalid faction can spawn one. Its five-frame asset loads and renders at relevant zooms, and Phase 6 can use the class without class-specific hacks.

## Phase 6: Tick-zero founded economy and starter fleets

**Purpose:** Replace the normal prebuilt/random opening with the planned, funded world.

### 6.1 Opening transaction

In the simulation owner, apply the Phase 4 plan once at tick zero. Build crown/small ports, docks, roads, population, and one industry per colony through existing authoritative structures and infrastructure publications. Initialize faction and port/industry accounts, explicit starter stocks, grants, and costs in conservation ledgers. Make the operation atomic: failed placement, funding, asset validation, or unsafe spawn leaves no half-founded faction. Decide and document exactly which funds are grants and which are transfers; retire legacy per-port/per-industry grants where they would double-fund this mode.

### 6.2 Fleet start and compatibility boundary

For each national crown create one Man-of-War, one Brigantine, and one Schooner; for each national small port create one Schooner; for each Pirate small port create one Corsair. Read counts/classes from compiled configuration where tunable. Each starts at a valid berth or a safe reserved anchorage. The Man-of-War occupies the large pier exclusively, so crown merchants must not overlap it. Change normal `merchant-session.js` startup to use funded faction fleets and retire global-density/patrol quota decisions from normal play. Leave benchmark startup and its 50 merchants untouched.

**Developer prompt:** Implement deterministic, idempotent tick-zero founding from the validated plan and compiled world settings. Carry all created ports, industries, accounts, stocks, ships, and initial reservations into the worker and main-thread renderer without a second source of truth. Handle a failed grant/road/ship site by rollback or refusing Start with a precise error; never partially spawn a fleet. Preserve the fixed benchmark profile explicitly.

**Done when:** Per-faction colony and ship counts match the plan, no same-island duplicates or unsafe hulls exist, restart never duplicates grants/ships, and gold/goods conservation checks reconcile. The normal merchant-number slider no longer drives normal gameplay; fixed benchmarks remain identical in scenario setup.

## Phase 7: Offshore water and patrol visits

**Purpose:** Let big ships use small colonies without pretending they docked.

### 7.1 Anchor-only route

Reuse safe `DockTraffic.previewAnchor` and existing friendly-anchor water refill. Add a separate patrol/water waypoint path in `bridge-logistics.js` that can choose a friendly small-colony anchorage even when `canDock` is false. Respect diplomacy, ship draft, clearance, turn space, reservation occupancy, and departure. Prevent pathfinding from cutting shallow water to reach the waypoint.

### 7.2 Service boundary

Keep docked-only cargo purchases/sales, handling, repairs, ship construction, and registration behind an actual compatible berth. Record anchor visits and water received separately from dock transactions. Preserve existing friendly water behavior at large ports.

**Developer prompt:** Extend visit planning for large warships to treat a safe offshore anchorage as a patrol waypoint and water stop, not as a berth. Do not relax `canDock` for trade or construction. Test a Man-of-War at a friendly Small Dock, a hostile island, a shallow/blocked anchorage, and a crowded harbor. Make failed visits replan without stranding a vessel.

**Done when:** A large ship anchors and refills at a friendly small colony, then continues patrol, while all docked-only services remain unavailable there.

## Phase 8: Sustainable economic growth

**Purpose:** Prove the opening can fund its own next step rather than merely look populated.

### 8.1 From three foundations to factories

Audit `dist/industry-investment.js`, construction, roads, funded orders, and goods ownership. Ensure AI factions can acquire materials and construct ironworks from Iron Ore and Wood plus a finite documented Iron Bars seed; then textile mill, cannon/cannonball foundries, and optional Sugar/Rum. Keep one-industry-per-colony as an **opening** constraint; later factories may share an island only through legal expansion of its existing colony. Do not create a second port on that island.

### 8.2 Long-run checks and visuals

Add deterministic long-run scenarios for two nationals with Pirates off, three nationals, and Pirates on. Inspect stock depletion, bankruptcies, demand, shipping throughput, construction stalls, and persistent deficits. Verify sawmill/foundry art and markers during actual growth. Adjust validated configuration defaults only with measured evidence and record any new money/goods source.

**Developer prompt:** Make the first economic expansion materially possible under current funded market and conservation rules. Prove a seeded game can move from opening industries through ironworks and textiles toward shipyard inputs without infinite startup stocks or unexplained gold. Report legitimate shortages, especially Sugar/Rum when optional, rather than masking them with automatic grants. Keep player-controlled faction work out of this update.

**Done when:** At least one representative two-national scenario builds the planned supply chain and trades under finite funds. Conservation remains exact; failures explain missing materials, cash, road or demand instead of silently stalling.

## Phase 9: Shipyard tiers, art, and vessel orders

**Purpose:** Turn economic growth into funded shipbuilding without reviving the global ship slider.

### 9.1 Tier and site model

Define shipyard tiers tied to vessel size and compatible dock: Small, Medium, Large, ExtraLarge as needed. Specify population, construction material, land footprint, road access, build duration, and ownership/funding gates in the catalog and validated configuration. Avoid circular recipes: a lower tier and the supply chain must make the next tier reachable. A colony may build only at an existing legal site; one-colony-per-island still holds.

### 9.2 Final shipyard assets

Generate original tile art and icons for each visually distinct tier plus an under-construction state if shown. Preserve source art and provenance, assemble atlas frames through reproducible scripts, register asset IDs and catalog references, and inspect building-scale and overview rendering. No generic placeholder tile may represent a finished tier.

### 9.3 Funded ship construction

Accept an AI ship order only after reserving money and owned/paid materials, verifying tier/berth/launch water, and respecting the faction fleet strategy. Complete after configured construction time; atomically consume resources and create one ship with a safe berth or anchorage. Support cancellation/refunds, queued jobs if permitted by config, interrupted builds, and idempotent restart. Do not allow warships through Small Docks or Corsairs for national factions. The new fleet size derives from completed ships, not density or patrol quotas.

**Developer prompt:** Build catalog-defined shipyard tiers and fully funded ship orders on top of Phase 8's supply chain. Create and integrate final tier artwork in the same phase. Validate one order from materials through building, launching, and fleet registration; cover failure, cancellation, and replay. Show the new yard and build state in the map and economic UI. Do not add combat or player fleet commands.

**Done when:** AI can grow a colony, build an appropriate shipyard, fund and launch a compatible new vessel, and cannot double-create a ship or spend unowned stock. All tiers have correctly mapped finished art and readable icons.

## Phase 10: Integration, performance, and merge

**Purpose:** Make the whole Economic Improvement update reviewable and safe to enable.

### 10.1 Full seeded matrix

Run the focused configuration, draft, terrain, dock, water, finance/goods, visual/asset, AI-growth, and shipyard checks on 32/128/512 worlds. Verify valid and invalid national selections, Pirate toggle, seed replay, restart, no-combat boundary, and one-colony-per-island invariant. Confirm playerless normal mode starts after the AI draft. Record known maps unable to start and show their warnings.

### 10.2 Fixed benchmark comparison and release

Run the unchanged world-generation and simulation benchmark buttons on the same device, browser, viewport, and resolution as Phase 0. Compare output schema/scene/ship count, generation time, frame and worker timing, messages, and memory; report both gains and regressions. Separate normal-mode measurements because its world and fleet are intentionally different. Review documentation, source assets, generated catalog consistency, and any migration/legacy behavior. Open the final integration PR from `feature/economic-improvement` to `main` with test evidence and limitations; merge when reviewed.

**Developer prompt:** Validate the complete Economic Improvement feature as a real economy, not a collection of isolated starts. Demonstrate deterministic supported and unsupported maps, the full seeded industry-to-shipyard path, correct AI and Pirate opening, water-only anchorage, exact conservation, complete art, and unchanged fixed benchmarks. Produce a concise before/after report and a reviewable PR. Mark the update complete only once the final PR is merged to `main`.

**Done when:** All required checks and visual inspections have attributable results, regressions are addressed or explicitly accepted, no normal or benchmark start is accidentally mixed with the other, and the integration branch is merged.

## Open defaults to confirm before implementation reaches them

- Corsair is the working Pirate-only class name. Set cargo, draft, armament fields, and art specification within the Small Dock's Medium capacity and safe-water constraints; no functional combat yet.
- The national opening mix above is a suggested default. If another Medium-class merchant is desired, change the validated setting and corresponding safety/finance checks rather than adding a hidden exception.
- The sawmill-on-forest → existing `WOOD` output and optional initial Sugar policy are proposed in the source playbook. Confirm before Phase 2 is merged.
