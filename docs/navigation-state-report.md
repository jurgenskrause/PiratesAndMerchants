# State of the game: navigation safety

The deterministic sailing overhaul is implemented for civilian and military ShipAgents. Controlled tests found no island or map-border groundings. Generated-map tests also check hull safety during harbor maneuvers, rather than checking sailing alone.

## Navigation behavior

- Hex A* retains distance, prevailing-wind/polar efficiency and relational faction-threat costs. A cached additional cost penalizes every land-adjacent hex crossed by a segment, including route simplification. Narrow passages and port access remain available when a detour is impractical. Land and hull-invalid segments remain blocked; rectangular map bounds are now checked explicitly.
- Direct sailing and native momentum-based upwind tacking remain separate from macro waypoints. All seven hull classes use the same native ship physics and the same update frequency.
- Five probes run on every sailing physics substep: center, ±20° and ±45°. Their range increases with ground speed and hull yaw-response time. The range ends at the current waypoint when that waypoint is nearer, because the route can turn there; a hull-length minimum remains.
- The probe fan evaluates land safety before waypoint and traffic steering. Routine side hazards retain canvas and native propulsion, with wind-aware escape headings outside the no-go zone. A committed tack continues through a distant probe warning when its turning arc and exit remain clear. Immediate land danger or a blocked exit overrides the tack; close land danger permits shortened canvas and braking, while bare poles are reserved for reverse/pivot recovery. Escape targets are reconsidered at a bounded cadence or immediately when blocked.
- A fully blocked fan triggers a continuous, bounded reverse-and-pivot maneuver and requests an immediate local route recalculation. This is an arcade recovery assist, not simulated reverse sail thrust. Movement is checked against the chart and never teleports across terrain.
- A final swept-hull guard checks translation and rotation around the unchanged native physics step. Unsafe proposals are rejected and backed off safely. Harbor movement has a separate guard: it can translate before rotating, pivot before translating, or back away to make room. Anchoring/recovery can retain a safe final heading.
- Wind replanning still requires a wrapped deviation greater than 10° continuously for more than the configured persistence window, default five simulated seconds. Newly high-threat cells on the remaining corridor trigger an immediate replan. Local obstruction recovery is a separate safety trigger.

## Measured verification

| Check | Result |
|---|---|
| 42 coastal fixtures: seven hulls × island, bay and four borders | All reached the safe-water goal; 85,850 physics steps checked |
| Coastal fixture telemetry | 38 evasions, 11 reverse/pivots; 0 unsafe hull poses, 0 native collision rejections, 0 final-guard interventions |
| Seven additional coastal upwind voyages | All reached their goal; 15 native momentum tacks; 0 unsafe hull poses |
| Deliberately excessive-speed guard test | Unsafe translation rejected; ship remained in water and inside bounds |
| 42 open-water trials, winds 0.1 / 0.5 / 1, both tack sides | 148 completed tacks; no luffing, grounding, failed tacks or turn reversals |
| Generated TRADEWINDS map, size 256, six merchants and four patrols, 240 simulated seconds | Hull poses checked on every bridge tick across all states; physical market discovery and cargo jobs passed |
| 30 merchants plus four patrols, headless fixed-step benchmark | Median 5.57 ms; 95th percentile 9.40 ms per 1/30-second simulation tick |
| Uniform physics frequency | Each of seven hull classes received exactly 200 native 1/60-second updates in the frequency test |
| Regression coverage | Economic/logistics acceptance, profitable delivery, home/allied patrol cycles, price ledgers, threat model, worker traffic integration, inspector, waypoint arrival, wind debounce and new-hotspot replanning passed |

The performance numbers measure headless simulation work, not browser rendering FPS or guaranteed 20× throughput. The collision result is confirmation for these tested charts, hulls and scenarios, not a claim that every possible generated chart has been exhaustively tested. The runtime guards continue enforcing the game's seven-point hull footprint and sampled sweep checks independently of route planning.

## Sail handling follow-up

A generated-map regression run measured 31,067 in-transit samples: **0.27% luffing**, 1,284 native tack samples and **zero crosswind bare-poles samples outside reverse recovery**. This measures one chart and wind configuration, not a universal rate.

Routine traffic give-way requests now use the wind-aware helmsman rather than bypassing it. Traffic maneuvers avoid the no-go zone, preserve canvas outside close quarters, and defer course changes during a committed tack. Tack preparation and recovery retain canvas to rebuild momentum. A large heading error alone no longer lowers sails. All seven hulls passed targeted crosswind sail, native momentum and committed-tack protection regressions.

## Runtime telemetry and current game state

Select an AI ship, then open **More info**. Navigation telemetry shows its steering mode, five-probe checks, evasions, reverse/pivots, route recalculations, sailing swept-hull interventions, harbor interventions and unsafe hull poses. Native collision rejections are also available in agent telemetry. Interventions are reported separately from unsafe poses: a prevented movement is not counted as a completed grounding.

The economic and physical-logistics source layers remain unchanged. Merchants still exchange price intelligence by docking, trade from their own ledgers and load/unload cargo over time. Military ships retain empty trading holds and home/allied patrol restrictions. Port governors, dual stockpiles, spoilage, upkeep, faction protection/threat and simulation-speed controls remain active. No ship receives reduced offscreen update frequency.
