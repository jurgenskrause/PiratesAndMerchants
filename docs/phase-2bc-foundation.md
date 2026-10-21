# Phase 2B/2C: Phase 2.1 foundations

Implemented the detailed Phase 2.1 specification. Later phases are deliberately not enabled: no new governor growth decisions, road A* aggregation, decay timers or renovation lifecycle have been invented from the phase headings.

## Data

`town_buildings.json` provides house, fountain, warehouse, stables and derelict definitions. Housing is population capacity only; other structures have zero capacity and no production, trade, maintenance or prosperity bonuses. Renovation costs default to 30% of construction costs. Costs accept `gold` and valid commodity IDs, with nonnegative finite quantities. `purchaseTownBuilding` delegates to the existing atomic infrastructure transaction, protecting reservations and consumption stocks. Placement and prosperity eligibility belong to the upcoming expansion controller, not this cost helper.

Building variants refer to asset IDs. Existing town atlas frames are reused as interim artwork, including a muted derelict version. They are not new purpose-specific fountain or stable illustrations. Asset metadata supports a selected atlas frame and optional tint; the catalog rejects invalid frame bounds.

## Pointy-top orientation

A pointy-top hex has vertices at north and south, not edges. Its screen-space edge directions are NW, NE, E, SE, SW and W. The requested logical labels N, NE, SE, S, SW, NW retain bits 1,2,4,8,16,32, respectively, and map in that order to those actual edges. This is an explicit 30-degree counterclockwise rotation from the requested diagram. Opposite bits and reciprocal connections remain correct without rotating existing terrain or ship navigation.

## Minimal road assets

Nine registered assets: endpoint, straight, two curves, four three-way junctions, and urban infill. Six rotations cover all one-, two- and three-edge masks without storing 64 tiles. Four-/five-/six-edge masks select a deterministic closest subset graphic, preferring missing visual arms to invented arms. The full logical mask is always retained. An endpoint asset handles network terminations.

`roadMasks` resolves adjacency; `resolveRoadTile` chooses artwork and rotation. Neither performs routing. Hub-and-spoke aggregation and shared-trunk A* are reserved for Phase 2.2.

`TownRenderer` renders infill under core town hexes and consumes optional per-port `roadTiles` (`q,r,mask`) and `buildings` (`q,r,buildingTypeId,variant,derelict`) records. It stays separate from simulation, caches textures, rejects stale asynchronous rebuilds and culls sprites outside the viewport. Infrastructure notifications rebuild the town layer alongside docks.

## Verification

Catalog and asset validation; all 64 masks; rotated straights/curves/Y junctions; reciprocal edges; immutable fallback connectivity; rejected unknown materials/graphics, invalid capacities and masks; default renovation multiplier; reserved-material rejection without partial deductions; construction protects consumption supplies. Existing Phase 1 and Phase 2A regressions remain covered.
