# Phase 2A: modular port docks

## Implemented scope

This phase implements the specified topology and modular docking sub-phase 2A. Roads, housing, town-building growth and additional colony presets belong to the later sub-phases; their detailed rules were not part of this brief. Ports now expose `townTiles`, `docks`, and `infrastructureRevision`, so those systems can extend a settlement without replacing navigation, markets or port identity.

## Definitions and starting settlements

`dist/data/docks.json` registers Small Pier, Cargo Dock and Deep-Water Quay. Each defines its berth tier, simultaneous ship limit, construction materials/gold, daily upkeep, water-depth constraint, layout and six rotation descriptors. Descriptors select atlas assets/frames rather than rotating the painted camera angle. Existing artwork is reused, with a configured tint per dock type. The renderer resolves those descriptors and can asynchronously load additional atlas assets.

Ship berth requirements use Small, Medium, Large and ExtraLarge. War Galleon and Man-of-War migrate from the old PierEnd label to ExtraLarge while retaining mandatory whole-pier mooring. Sloop is Small, Schooner/Brigantine Medium, and Fluyt/Frigate Large. A dock's `required_min_berth_size` denotes its advertised tier: ships of that tier or smaller qualify. Quays accept Large and ExtraLarge vessels.

Generated colonies begin with one core town tile and their settlement profile's `initial_dock_type`, currently an established Deep-Water Quay. This preserves access for the existing fleet. Dock footing depth defaults to traversable water; it does not certify a ship's actual mooring depth. Full-hull checks independently require sufficient depth at its berth. Existing arcade rules still allow ships to cross shallow water slowly.

## Spatial rules

`hex-topology.js` shares axial distance, six neighbors, bounds-safe tile lookup and water/coastal/inland classification. A cached multi-source BFS measures each water tile's distance from land, once per immutable generated world.

Construction requires an unoccupied coastal land tile adjacent to a town/core tile belonging to that port. Its facing water tile must be adjacent, traversable, and meet the dock definition's minimum depth. Every existing dock's facing water hex must be at least two axial steps away. Other settlements and industry tiles are protected. Orientation derives from the land-to-water neighbor direction. New sites also need a usable berth and a clear approach; active queue anchors cannot be built over.

## Allocation, sailing and queues

Each port owns a BerthManager with its dock list. DockTraffic keeps vessel reservations against a port and a specific dock; slots are local to that dock. The first suitable free berth is assigned deterministically. A queued capital ship reserves no partial berth and cannot be starved by later arrivals at its compatible quay. Smaller ships may use an independent smaller pier. Different docks permit independent approaches, while a single dock serializes approaches/departures. A proximity guard prevents allocating physically overlapping mooring positions across docks.

AI route evaluation filters incompatible/unusable destinations and ends corridors at a compatible dock's water hex, with a safe approach point. Incoming AI uses APPROACHING before DOCKING, queries allocation, and moves to anchor when full. Berth promotion resumes docking automatically. Player proximity detection includes every dock; the docking prompt explains nominal incompatibility, and departure/recovery use the assigned dock rather than the original pier.

Anchorage prefers water two to three hex steps from land, reserves unique hull-spaced hex centers, and keeps departure passages clear. Crowded or geometrically constrained ports extend the anchorage farther offshore. Large ships retain safe turn clearance and whole-pier end mooring. The existing animated pier-end correction remains available if a docking maneuver touches land.

The ledger, stockpiles, cargo service and voyage identity remain per port. Adding docks never creates a second market or inventory.

## Governors and costs

Per-port governors review congestion on staggered, map-scaled intervals. Average waiting time combines active waiting and a bounded recent history. Waiting ends when approach clearance is granted; sailing alongside is not counted as queue delay.

When the average exceeds the profile's scaled `max_queue_wait_ticks`, the governor attempts a dock suitable for the oldest waiting vessel. It obeys site rules, a scaled cooldown and a configured dock limit. Construction charges the owning faction treasury and consumes that port's unreserved trade materials, atomically. Consumption supplies and held construction/shipyard reservations remain protected. Lack of money, materials or a safe connected site leaves the world unchanged and records the reason in governor telemetry.

Dock upkeep is prorated by elapsed simulated time and paid from the faction treasury at reviews. Treasury depletion does not create negative money; governors pay available funds. This is a minimal infrastructure funding rule, not a new taxation/prosperity model.

## Rendering and performance

New dock records travel from the simulation worker as one-time infrastructure deltas, rather than a whole-world copy every frame. The map refreshes dock visuals/tile inspection when those records change. Port tooltips show dock count, berth tier, queue count and average wait; ship tooltips identify the assigned dock type.

Hull-clearance offers are cached by dock type and vessel geometry. Candidate scans run only on congestion reviews. Site approach validation uses bounded segment checks rather than a second expensive macro route search. Coast distance is computed once. This sub-phase introduces no roads or terrain mutations. Stopping a sea trial restores its generated infrastructure, so restarting does not inherit buildings funded by a previous reset economy. Existing fixed physics timesteps and ship snapshot interpolation remain intact.

## Validation

`tests/phase2a.test.mjs` covers tile categories, axial distance, connected construction, spacing, foreign/industry protection, rotation selection, berth hierarchy, depth rejection, offshore queues, congestion growth, immediate promotion, cooldown, protected stock and atomic funding, and worker-change deltas. Existing generated-coast capital docking/recovery, economic/ledger, merchant, military, UI and traffic-performance suites remain regression checks. These are headless correctness checks, not a measured browser FPS claim.
