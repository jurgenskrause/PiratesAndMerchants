# Varied world-generation coverage

The generation-matrix test covers sixteen fixed scenarios: CORAL, MONSOON and NORTHSTAR at 32, 128 and 256 hexes; sparse/dense islands; minimum/maximum roughness and mountains; dry/wet terrain; and a 512-hex chart. Fixed inputs make failures reproducible and keep the suite independent of wall-clock timing.

Checks compare complete terrain hashes, generated colony definitions and industries across independent identical generations. They validate unique port IDs/names, housing capacity, non-overlapping ownership, dock footprints and approach fans, coastal clearance for every berth, and boundary-connected ocean access. A connected road-network traversal verifies every industry reaches its assigned settlement. Default substantial charts must support voyages; legitimately empty tiny charts are accepted.

Twelve eligible fleet scenarios request thirty merchants. Every spawned hull must have a safe pose, military registration must match its faction, military home ports must accommodate their hull, and every requested faction/class quota must be met. The 512-hex case tests generation and infrastructure, not fleet initialization.

Results: 16 worlds, 786 ports checked, 12 fleets, 428 ships checked, zero military quota shortfalls. Catalog validation passes. The complete suite passes all 71 test files with zero failures, including startup, military traffic, capital docking, native recovery and observation-frequency independence.

## Bug found

NORTHSTAR at size 32 exposed an unsafe fluyt launch. Merchant placement previously relied on hullDepth alone, which did not enforce the full navigation footprint/map-boundary predicate. Placement now also requires safePose at the actual launch heading. Military placement already used that predicate. Unsafe positions are rejected rather than forcing a launch. The new matrix retains this seed and fleet scenario as its regression.

## Remaining coverage

Ocean connectivity establishes hex-water reachability, not a navigable route for every hull in every wind. Full journey completion, long-running economics, worker publication/simulation-speed invariance, browser workflows and repeatable performance budgets remain separate coverage work. Passing these curated scenarios does not guarantee every possible seed can support capital fleets; arbitrary terrain may still impose legitimate limits.
