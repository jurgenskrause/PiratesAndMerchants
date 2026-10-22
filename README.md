# Pirates & Merchants

Terrain, ports and raw-material industry browser prototype. Serve `dist/` over HTTP with any static server. There is no build step and no external runtime CDN dependency.

## Current slice

- Seeded, spatially bucketed island bodies with domain-warped outlines, angular bays and peninsulas, plus Simplex detail and secondary moisture/rock fields, generated in a module worker.
- 32–512 pointy-hex maps stored in odd-row offset rectangles. Bounds are approximately square (width/height ≈ 1.16), with no rhombus slant. Axial/cube coordinates remain the geometry and neighbor system.
- Connected-component island census on unmasked terrain: any island touching an outer-row or outer-column hex is deleted in full, along with its complete underwater footprint by re-evaluating the field without culled island sources; detached shelf remnants are also removed. Remaining outer water samples are zeroed. Grass/forest/desert/rock classification runs after pruning.
- PixiJS 8.14.3 with one full-screen terrain filter. A Float32 RGBA data texture carries elevation, moisture and rock potential. The renderer rounds to the nearest axial hex and reads its exact gameplay elevation and biome inputs. Exposed edges are detected against the six neighbors. Only beach tiles receive wet-sand edge shading and a narrow antialiasing band; non-beach tile artwork remains unchanged next to water. No per-tile display objects.
- Pre-rendered watercolor terrain atlas: three variants each of beach, grass, forest, desert and rock. A coordinate hash picks each tile’s variant. Shader water and subtle paper modulation remain animated/procedural. The atlas has a mip chain with explicit zoom-based LOD and tile-safe UV insets. Close views get slightly softened detail and a 12% color wash; below 36 screen pixels per hex, detail progressively fades to broad biome colors, becoming an overview below 10 pixels. Fine paper grain and small waves also fade at distance.
- Pan, cursor-centered zoom, pinch zoom, keyboard navigation, whole-world fit, hidden-by-default hex inspection, elevation and biome views. The initial chart is 32×32, centered on the largest island at building scale. At 100%, a hex is 55 px across and denotes one fort/industry footprint. Press 1 for building scale at the current location or 0 for an overview.
- Island radius, separation, domain-warp distances and biome noise frequencies are fixed in world units. Map dimensions only expand the world and its seeded spatial buckets. Retained islands keep identical geometry for a shared seed and settings. Islands removed at an old boundary can reappear when a larger map fully contains them.
- Island size expands more strongly above the midpoint, reaching a base radius of 23 world units at maximum (7.5 at midpoint). Spacing expands with radius, so the setting creates larger islands rather than simply merging densely packed small islands. Density maps nonlinearly to candidate activation: 1% at minimum, about 64% at the default, and 99% at maximum. Sparse or oversized settings can leave no complete islands, which the UI explains.
- Density/size/roughness/moisture/highlands settings are staged until Generate. Random seed regenerates immediately. All geography is deterministic for the same seed and settings.
- Feature-detected WebMCP `generate_terrain` uses the same UI settings and generator.

## Validation

`node tests/world.test.mjs` checks determinism, changed seeds, density effects, island area accounting, ocean boundaries, all five dimensions and hex/cube round trips.

The 512² generator took approximately 287 ms with the hex-aligned terrain texture in the development environment. This is not an FPS benchmark. The app displays a live measured ticker rate.

Native EGL/GLES rendering tests compile and link the actual shader, render a seeded map, assert visible land, and verify that the hex-grid toggle changes pixels. They verify reduced texture contrast at distant zoom, full shelf removal, and identical non-beach interior pixels with water vs land neighbors and retain beach-only edge shading. They reproduce the old GLSL ES 1.00 array-constructor error before verifying the explicit GLSL ES 3.00 fix. Run `python tests/render_shader.py` with Mesa EGL and Pillow. Full browser interaction, touch and WebMCP runtime validation remain unavailable.

## Deliberate prototype limits

Rendering currently selects WebGL2; a matching WGSL program and WebGPU-first capability selection remain future work. The terrain pass uses one screen quad through Pixi's filter system, which also entails offscreen/composite work; it is not a claim that the entire frame uses one GPU draw call. Render resolution is capped and the terrain filter runs at CSS-pixel resolution.

Water uses two oppositely scrolling procedural noise layers. Land is the union of hexes whose elevation is at least 0.35. The visual shoreline matches that classification, apart from a narrow subpixel antialiasing band. Beaches run inside exposed land edges, with the 0.35–0.40 elevation band also rendered sandy. `sampleWorld` returns the same nearest-hex data; future ships still require swept collision tests against land hexes, including hull clearance, rather than point sampling alone.

Towns, roads, ship entities and trade simulation are intentionally absent. Cotton plantations, iron mines and sugar plantations now spawn as complete hex-tile surfaces. Ports now consist of one dock and one adjacent Harbor Master office; no other support buildings are generated. Terrain and camera use continuous world coordinates; future movement can remain independent of the tile data. Painted grass, tree clusters, sand and rock outcrops establish the watercolor terrain. Six dock illustrations retain a fixed camera perspective. Four Harbor Master office sprites include British, Spanish, French and pirate faction flags. The first port pass places one dock per eligible island of at least 50 land tiles, using a coastal water hex connected to the boundary ocean. It prefers open water and sandy/grass attachment tiles. Full ship-clearance checks remain future movement work.

## Layout

- `dist/world.js`: deterministic pure world and coordinate routines
- `dist/generator.worker.js`: generation worker and transfer ownership
- `dist/terrain-shader.js`: GPU terrain and water shading
- `dist/app.js`: Pixi rendering, camera and UI
- `dist/index.html`, `dist/style.css`: map workshop
- `dist/vendor/`: pinned PixiJS and simplex-noise
- `tests/world.test.mjs`: engine invariants

PixiJS and simplex-noise are MIT licensed. Their source headers and license files are retained in `dist/vendor/`.

Art provenance and exact generation prompt: `docs/terrain-art.md`.

## Ports

- `dist/data/port-names.json`: versioned, read-only faction name database, with 24 fictional names per faction (96 roots). Duplicate roots receive Roman numerals on large charts.
- `dist/ports.js`: seeded placement, ocean connectivity, minimum island size, unique names and faction assignment.
- `dist/port-renderer.js`: six independently painted dock orientations, edge anchor calibration, four flagged office sprites, zoom culling, overview markers and port labels. No sprite is rotated.
- `dist/dock-atlas-v2.png`: 3×2 transparent atlas in E, NE, NW, W, SW, SE attachment order.
- `dist/harbor-master-atlas-v2.png`: 2×2 transparent atlas in British, Spanish, French, pirate order. Flag motifs are stylized faction identifiers, not a claim of period-exact heraldry.
- `docs/port-art-prompts.txt`: exact built-in image generation prompts.

The dock occupies a water hex. Its measured artwork attachment point is placed at the inset shared-edge midpoint with the adjacent land hex, which contains the Harbor Master office. The Port Register focuses the camera on a selected port; hovering either tile shows its identity and role.

`node tests/ports.test.mjs` checks the 49/50-tile threshold, seeded identities, unique names, land/water adjacency, all six anchors and all four factions through 512×512. Native GLES tests also render the dock and office art over the map for inspection. Browser UI QA remains unavailable in this environment.

## Raw-material industries

`dist/industries.js` places cotton and sugar on grass/forest and iron mines on rock. Port tiles are reserved. Each industry occupies exactly one hex, with at least a one-hex gap between industry centers. Small islands below six land tiles are left undeveloped; larger island budgets grow with area and the industry-density setting. Where suitable terrain exists, the generator distributes the three resource types.

`dist/industry-atlas-v2.png` contains three opaque, full-bleed square artworks: cotton, iron, sugar. The terrain shader clips and samples each artwork across the whole hex. It replaces the terrain surface, never adds an overlaid building sprite. The data texture's alpha component is a numeric terrain tag: 1 for ordinary terrain, 2 cotton, 3 iron, 4 sugar. These are unpremultiplied Float32 data values, not opacity.

Industries share zoom-dependent mip sampling and the broad-color overview mode. Dock and Harbor Master sprites also have mipmaps and smoothly fade to port markers between scales 16 and 7, so distant views do not carry tiny building detail. Future town rendering should follow that same structure-detail policy. Production quantities, trade routes and ownership simulation remain future work.

`node tests/industries.test.mjs` checks deterministic placement, terrain suitability, single-tile footprints, port reservations and zero-density removal through 512×512. Native GLES tests render all three industry tiles and verify that changing the underlying biome does not alter any interior tile pixel.

Industry art was generated with the built-in image tool; exact prompt: `docs/industry-art-prompt.txt`.

## Framed hex artwork

Only land cells have a narrow beveled wooden rim, rendered in the terrain shader. Trim fades at overview zoom to avoid grid noise. Terrain and industry paintings remain inside their cell; docks and Harbor Master artwork have inset hex masks so nothing covers the rim or neighboring tiles. Offices are sized to keep the complete flag and building within their cell. Water and dock cells have no wooden trim. Dock attachment anchors follow the inset cell edge. Existing texture mipmaps and structure overview markers remain active.

Structure artwork was re-rendered as complete, compact overhead compositions in v2. Industry buildings and mine entrances are centered away from the hex corners; offices use short flag masts with clear space around the roof. All six dock anchors are calibrated to the new artwork. Exact built-in imagegen prompts: `docs/contained-structure-art-prompts.txt`.

`node tests/port-visibility.test.mjs` exercises the vendored Pixi graphics pipe: transform updates can clear the dirty flag on never-drawn offscreen masks, leaving their batch geometry empty. Revealing a port now invalidates both masks so the next draw rebuilds them. The test covers camera reveal and overview-to-detail visibility.

## Analytical ocean and wind

Wind begins with a random vector, adjustable direction and strength, and optional slow drift. Moving water pauses both the wind and ocean clocks. The displayed vector is prevailing wind; local shelter varies spatially.

`ocean.js` defines three shared wave components in world units: wavelengths 8, 4.5 and 1.5; amplitudes 1, 0.2 and 0.025; direction offsets 0, 0.08 and -0.18 radians. JavaScript and generated GLSL use the same coefficients and approximate trochoidal phase correction. Longer swells travel faster using sqrt(g*k) dispersion with arcade gravity 2.4. Integrated, bounded phases and smoothed strength prevent time-times-changing-speed jumps. Heading changes crossfade over four seconds between fixed wave directions; the shader evaluates three waves normally and six during a turn. No world-coordinate rotation during a crossfade.

`Ocean.sample(x,y,{distance,nx,ny,exposure})` provides matching height and lateral displacement for future ships without GPU readback. This is an analytical water approximation, not a fluid simulation or exact inverse Gerstner surface. Shore information can be sampled from the retained CPU masks. Ship physics is not implemented.

`shore.js` builds a static unsigned water-to-land chamfer distance and gradient mask in the map worker, at most 256 × 256 samples. A bounded, shore-gradient-dependent phase correction provides artistic bending/compression near coastlines. It is not a physical refraction solver; distance alone is not substituted into a global wavenumber. Crest thresholds, scrolling noise and coastal distance produce foam. Two counter-scrolling samples of the existing pigment texture add restrained watercolor micro-detail instead of glossy normal maps.

The terrain shelter field remains capped at 128 × 128 points. Higher/rockier land casts longer shadows. Directional exposure is cached and refreshed one row per tick only after the wind turns more than two degrees; exposure relaxes smoothly and uploads at 10 Hz. All swell amplitudes, lighting and foam reduce in sheltered water. There are no GPU readbacks or per-frame map-sized wave simulations in the application. Water still uses one full-screen terrain pass, world coordinates, and zoom detail reduction.

Checks: `node tests/ocean.test.mjs` covers dispersion, direction transitions, calm, amplitude scaling and bounded shore masks; `node tests/wind-field.test.mjs` covers shelter; `python tests/render_shader.py` compiles and renders the real shader and verifies waves, foam, lee attenuation and terrain regressions. Native tests use readPixels for assertions only; browser FPS remains hardware dependent.

The primary swell now dominates direction and whitecap placement. Secondary/chop lighting slopes are attenuated separately because multiplying amplitude by wavenumber otherwise makes tiny short waves as visually strong as the swell. Foam follows the primary crest with only a small total-height contribution, avoiding bright crossing nodes.

Wave shading projects each layer onto its own primary wind heading before direction crossfades. This keeps contrast consistent at north/south/east/west rather than allowing a fixed screen-space light to emphasize different wave families. Cardinal-bearing GPU checks compare along-wind and crosswind gradients.


## Local gusts and crest breaking

The coarse CPU wind field now carries a smoothly evolving local vector (RG), gust multiplier (B), and island exposure (A). Two advected broad noise bands vary strength within 0.68–1.32 of prevailing wind and direction within approximately ±10 degrees, with gradual relaxation at 10 Hz. Gusts modulate swell amplitude and breaking propensity; the prevailing direction remains the swell direction, so small local wind changes do not rotate existing crests. World-anchored gusts remain independent of camera motion. Calm and pause are preserved.

Whitecaps no longer use a common scrolling noise stencil or pigment overlay. Each travelling primary crest has a stable identity, retained across phase wraps via a cycle counter. Independently seeded, overlapping events vary their along-crest position, width, duration, start time and probability. Their smooth birth/death envelopes follow the moving crest; neighbouring crests do not reuse the same event mask. Wind turns crossfade old/new event fields alongside the swells. The Local wind layer shows strength by color and direction with arrows, including sheltered water. This is an inexpensive procedural gust approximation, not CFD.

## Sloop sea trial

Use Test sloop in the header. Left/right steer; up/down progressively set canvas from 0–100%; Escape exits. The same controls are available as hold buttons. Reset launch respawns safely near the selected port (or first port). Follow ship can be disabled to pan. Changing the world exits the test. Controls clear on blur and hidden tabs; arrows in form inputs keep their usual behavior. Physics pauses in hidden tabs; Moving water only freezes the wind/water animation, not ship movement.

`ships.js` supplies continuous world-coordinate ship state, deterministic 60 Hz steps, inertia, local-wind sampling, no-go sailing angle, sail-area/mass acceleration, rudder effectiveness and draft-based shoal resistance. Swept small timesteps with bow/stern/beam depth probes stop land and map-boundary crossings. Turning from rest has a small arcade assist. Depth is an approximate conversion from terrain height, not measured bathymetry. Speed is shown in world units per second. There is no combat, cargo or docking interaction yet.

The data-driven catalog includes Lugger, Sloop, Schooner, Brigantine, Frigate, Fluyt and Ship of the line; values are arcade balance parameters, not historical specifications. Only the sloop has art and a selectable test mode. New classes can use the same model with their own graphics. Four top-down watercolor canvas states interpolate visually from furled to full sail, with registered hull anchors. The ship moves freely across hexes and is not clipped to a tile. Asset prompt and provenance: `docs/sloop-art-prompt.txt`.

`node tests/ships.test.mjs` verifies vessel profiles, wind response, canvas limits, calm, steering, draft/drag, collision, spawn and bilinear local wind sampling.

## Automatic sail trim

The ship automatically adjusts signed sail angle to apparent wind (local wind minus boat velocity, with an arcade wind-speed conversion). It sheets in close-hauled, eases on a reach/run and changes sail side across tacks. A small dead band stabilizes tack selection at the bow/stern; sail transfer is rate-limited and temporarily reduces drive while trim catches up. The close-hauled polar now reaches efficient drive closer to each vessel's no-go boundary. Steering still determines heading, and up/down still controls canvas. No automatic course changes or new artwork were added; the later minimum-steerage rule also allows slow headwind progress. The HUD reports tack and automatic trim angle. Tests cover both windward tacks, symmetry, smooth sail transfer and unchanged canvas.

## Ship wake

A speed-dependent divergent wake and soft center wash trail the stern in world coordinates. Old sections expand and fade in place as the ship turns; new sections follow its actual course over water. A maximum of 96 samples live for 3.5–7 seconds, with bounded emissions, 20 Hz geometry refresh and zoom-based opacity reduction. Stroke endpoints and midpoints are checked against water so wake foam is omitted over land. Stopping ends emission and leaves existing wake to fade. Reset, exit and world regeneration clear the trail. This is a visual wake approximation, not a fluid solver, and does not apply forces to other ships.

`node tests/wake.test.mjs` covers emission, turning history, spreading/fading, stop/reset, bounded memory and actual vendored Pixi stroke creation/land rejection. Control tests cover the integration lifecycle.

## Minimum steerage

With canvas set and wind at least 2.5%, target forward speed is at least 10% of the vessel's configured maximum, scaled by the square root of canvas. This arcade floor applies through headwinds and navigable shallows, with normal acceleration rather than an instantaneous velocity jump. Leeway is lateral so it cannot cancel forward steerage. Furled sails, complete calm, land and map boundaries retain their stopping behavior; any positive water depth is traversable. Wake contrast is gently boosted at low speed while emission and spreading still follow actual motion.

## Ocean depth reference and cloud shadows

Open ocean has four seeded depth bands (8, 16, 28 and 44), shaded progressively darker. Low-frequency noise creates broad, world-anchored basins during generation. A cached depth texture provides one lookup per water fragment; ship physics and shadows sample the same depths. Coastal shallows remain continuous and all water is navigable. The previous parallax seabed texture is removed.

`atmosphere.js` supplies two independently evolving, domain-warped cloud-shadow fields: smaller/sharper lower clouds and broader/softer upper clouds. Integrated wind displacement drives different drift rates without time-times-changing-wind jumps. Shadows are world anchored while panning, shade terrain, structures, wake and ship together, and remain below approximately 21% combined opacity. A single half-resolution viewport overlay provides softness and limits fragment cost; map size adds no cloud buffers or CPU simulation. Debug map layers hide cloud shadows, and Moving water pauses their clock and wind displacement. They are approximate altitude layers, not volumetric clouds.

Native shader checks cover compilation, premultiplied-alpha compositing, bounded opacity, temporal drift, pause stability and world anchoring under camera movement. Browser FPS remains hardware dependent.


## Hull tracking and all-water navigation

Velocity is resolved along/across the hull each step. Strong lateral resistance (scaled by length and draft) dissipates sideways slide quickly; lower longitudinal resistance preserves forward momentum and coasting. Modest wind-driven leeway remains. Heading is still controlled through the rudder, not snapped to velocity.

Any water tile permits motion regardless of draft. Draft affects shallow-water speed, never collision eligibility. Launch checks and wake clipping use the same positive-depth rule. Land under hull probes and map bounds remain blocking. Ship tests cover sharp-turn slip, lateral versus forward damping, shallow-water launch, land collision, and movement for all seven vessel profiles in nearly-zero-depth water.

## Ship shadow and map HUD

A darkened copy of the active ship sail frames renders beneath the wake and hull, with a fixed down-right light offset. Sampled water depth is smoothed over time: shallows pull the shadow closer and make it darker/sharper; deep water produces a larger offset and softer, fainter shadow. A small local two-pass blur is limited to the ship silhouette. The shadow follows heading/canvas and hides on test exit/reset.

Map legends and view selectors now share a bottom HUD column instead of independent absolute positions. Explicit `.legend[hidden]` styling prevents the normal flex rule from displaying the inactive wind legend over the terrain legend. Wrapped rows reserve their own height; the mobile sailing panel tracks HUD height through ResizeObserver to avoid covering controls.


## Discrete canvas

Up/down presses and canvas buttons change one setting: 0 Bare poles, 1 Shortened sail, 2 Easy sail, 3 Working sail, 4 Full sail (0/25/50/75/100%). Holding a key does not repeat. Ships launch at Easy sail. Physics uses the discrete capacity; automatic trim remains independent. Existing registered sail artwork represents each setting, with the 75% setting using a fixed blend of half/full frames.


## Low-wind visibility and render isolation

Water contrast uses a piecewise visual response: 0/10/100% wind maps to 0/50/100% visual amplitude. Actual wind speed, travelling phase speed and sailing forces are unchanged. Lee exposure still attenuates the result. Native shader checks cover visibility on all four depth bands at 10% wind.

Wake geometry, ship sprites, ship shadows, port structures and labels now have separate Pixi render groups. Rebuilt wake stroke buffers cannot share batches with sprite quads. This targets intermittent stretched sprites; the intermittent on-screen failure has not yet been reproduced locally.

## Mainmast pennant

A solid faction-colored pennant sits at the sloop artwork's mainmast above the sail frames. The sea trial takes faction/color from its selected launch port (pirate fallback when there is no port). Each ship profile carries a relative mainmast attachment; future vessel artwork should calibrate its own point. Wind uses the local sampled field minus boat velocity, matching the sail-trim conversion. Smoothed apparent wind sets direction, extension and flutter rate; calm cloth hangs still. A bounded 18-vertex polygon updates at 30 Hz in its own render group, with no cloth simulation or texture allocation per frame.


## Momentum tacking and fixed pennant

Pennants are fixed at 3× with no tuning slider. Faction catalog objects define a separate bright `pennantColor`, propagated through ports into the active ship.

The sloop has a ±45° no-go cone; other hulls retain their configured cones. No wind-driven thrust acts inside. Crossing into the cone above 30% of hull maximum speed grants a momentum window: forward loss is only 2.5% per second, and yaw responds with a longer inertial time constant. Entry depends on measured forward velocity and wind-relative angle, never steering intent. The window ends on leaving the cone, reaching the floor, hitting land, or exceeding `2 * noGo / turnRate * 1.8 + 0.5` seconds. Re-arming requires a full second at least 0.12 radians outside the cone, preventing edge chatter from refreshing the window.

Below threshold or after expiry, maximum upwind drag converges to the base speed. The base speed is now always 10% of hull maximum in navigable water, including bare poles and calm, superseding the prior canvas/wind-dependent floor. Land and map bounds still stop ships. Invisible auto-trim takes its optimum angle immediately and applies normal acceleration outside the cone. No new HUD, prediction, rendering or simulation buffers are involved. Tests cover mirrored tacks for all seven hulls, retained momentum, stalls, timeout, repeated boundary crossings, minimum speed and collision.

## Tack indicator, stopped steering and bare poles

A screen-aligned circle follows the ship during a momentum-assisted tack. Its remaining arc tracks `1 - tackTime / tackDuration`, changing green/amber/red; it disappears when the tack ends. Luffing (canvas set, wind present, within the no-go cone, no momentum assist) uses a gentle 1.5 Hz red opacity/size pulse and the existing status line. No sails, calm and blocked movement suppress the warning. Geometry is bounded and refreshed at 30 Hz in a separate render group; reset/exit clears it.

Rotation is always permitted, even when hull probes touch land or the map edge. Collision still blocks translation, but never resets yaw or heading. Minimum rudder authority is 35% of the hull's turn rate before canvas adjustment.

Bare poles supersede the earlier unconditional speed floor: they coast down to at most 0.04 world units/second of wind-driven drift, with no sail thrust, tacking assistance or minimum forward speed. Calm bare poles settle to rest. There is no separate current field yet. Canvas set retains minimum steerage and existing shallow-water traversal.

## Low-wind tack readiness

Default chart size is 256×256. The sloop no-go cone is ±35° (other hull profiles retain their own values). Tack entry threshold now scales with local wind: `max(0.9 * minimumBaseSpeed, 0.30 * hullMaxSpeed * localWindStrength)`. Thus minimum-steerage sailing in light wind can qualify, while calm below 2.5%, bare poles, blocked hulls and unarmed/cooling-down tacks cannot show readiness. The floor no longer cancels an active light-wind tack unless forward speed falls below 95% of base speed; timeout still limits sustained upwind momentum.

On entry, the time allowance is snapshotted using the hull's available turn rate at entry speed, including canvas adjustment, rather than its maximum turn rate. This lets a low-speed turn finish without guessing steering intent or refreshing its clock during the tack. Tests build speed from rest and complete both tack directions at 5/10/20/50/100% wind.

A soft green glow beneath the ship indicates actual tack readiness, and switches off inside the cone, during a tack, with bare poles, or while blocked. Static translucent geometry avoids blur filters and per-frame tessellation. The existing ring takes over during the tack; red throbbing still denotes luffing.

## Tack-ready speed streaks

The green readiness glow is replaced by pale cyan-white speed streaks shed from both sides of the hull. Readiness opacity eases over 0.28 seconds; each streak also fades in/out over a 0.55–0.85 second lifetime. Losing readiness stops emission while the existing trail fades. World-space particles retain their direction through turns. A maximum of 24 particles, 30 Hz geometry updates, zoom fading and land clipping keep the effect lightweight. The tack countdown and red luffing pulse are unchanged.

## Central launch base

New maps select the port nearest the map center by dock position and start the chart there. Sea trials use that port as their default launch base and faction; explicitly selecting another port overrides the default. Spawn search prefers depth ≥8 with a three-unit ring of water clearance and room ahead, within 28 world units of the base. Charts without deep water fall back to nearby navigable shallows; charts without ports use the map center as the search origin.

Speed streaks now emit in narrow lanes directly behind the stern, with no sideways velocity. Longer dashes stream aft faster than the ship's travel, while retaining fade-in/out, bounded counts and world-space turn continuity.

The readiness effect now uses short, faint, ground-fixed air streaks across the hull's full width. The ship passes over them at its actual ground speed, so there is no artificial backward exhaust velocity. Individual dashes keep their fade envelopes and turn continuity.

## Wind-angle underlay

A translucent pie dial beneath the sea-trial ship shows red for its exact no-go cone, amber for the next 0.18 radians, green where the shared wind-angle drive curve reaches at least 96% of its maximum, and blue for other sailable headings. It uses local true wind, matching the physics no-go test. A gold notch points upwind and a white pointer follows the ship heading. Colors express angle efficiency, not absolute speed; depth, canvas and wind strength still affect speed. Existing tack countdown and luffing pulse remain independent. Geometry is cached per hull cone; only transforms change with wind/camera. The dial hides in calm and on trial exit.

## Playable fleet and upgrade levels

The roster is now Sloop, Schooner, Brigantine, Fluyt / Merchant Galleon, Frigate, War Galleon and Man-of-War. The sea-trial selector launches each hull using its own collider, draft, mass, sail area, turn rate, leeway and preferred wind angle. Square rigs favor broad reaches; the wind-angle dial shares the same hull-specific drive curve. Existing all-water traversal remains: draft slows deep hulls in shallows, while only land and map bounds block movement. Sea-stability values are provisioned as profile data; rolling damage is not simulated.

Each ship owns `armament` and `armor` metrics with immutable hull `capacity` (1–5) and validated `active` (1–capacity). New `Ship` instances start at active level 1 for both, including the Man-of-War. Trial dropdowns change active levels and retain that hull's test loadout during the current session. These metrics reserve the upgrade system; no guns, damage, purchases or currency are implemented.

Six new transparent five-state atlases provide bare poles, shortened, easy, working and full sail. The existing sloop retains its registered artwork and fixed working-sail blend. Atlas loading is deferred until selection, then cached; changing ships or exiting during a load cannot launch an obsolete selection. Mainmast pennants, depth shadows, wakes, particles, tack rings and sailing dials follow the active hull. Slowly turning capital ships use bounded momentum decay over their longer tack window.

| Hull | Armament capacity | Armor capacity | Cargo units |
|---|---:|---:|---:|
| Sloop | 2 | 2 | 30 |
| Schooner | 2 | 2 | 90 |
| Brigantine | 3 | 3 | 150 |
| Fluyt / Merchant Galleon | 2 | 3 | 420 |
| Frigate | 4 | 4 | 220 |
| War Galleon | 4 | 5 | 320 |
| Man-of-War | 5 | 5 | 350 |

## Forgiving sailing balance

No-go half-angles are now Sloop/Schooner 35°, Brigantine 40°, Frigate 42°, and Fluyt/War Galleon/Man-of-War 45°. No vessel exceeds 45° off the local upwind direction. Physics, tack timing and the dial use these shared values.

Shallow-water drive now ranges from 60% to 100% using a smooth depth-to-draft curve, replacing the previous 18% floor. Full drive returns at draft + 1.8 depth units. Deeper hulls still experience more drag at the same water depth, while all positive-depth water remains navigable. Tests verify the softened extreme-shallows speed floor across the fleet.

## Minimum green upwind sector

Every hull's dial now includes a continuous green upwind sector from 55° to 90° off the wind on both sides, guaranteeing at least 35° per tack. The green region also retains each hull's favorable broad-reaching angles. Green means good sailing/tacking, rather than exclusively ≥96% peak drive. Red remains the hull's actual no-go range, and the amber transition ends before the guaranteed green sector. This is a guidance change; the wind-driven thrust curves are unchanged. Tests cover both sides of every hull from 55° through 90°.
# Headless economy

Layer 1 is available in `dist/economy.js` with TypeScript declarations in `dist/economy.d.ts`. It implements production/consumption ticks, owned goods and material reservations, funded markets, conserved microgold accounts, separate faction treasuries and economic signals. See [the economic engine contract](docs/economy.md) for accounting rules and integration. Run `node tests/economy.test.mjs`. The sea trial now runs a temporary test economy in the merchant worker.

Layer 2 is available in `dist/logistics.js`: autonomous merchant trading, physical cargo, wind-aware routes, native ship steering/tacking, threat escape, black-market dumps and incident telemetry. See [the logistics contract](docs/logistics.md). Run `node tests/logistics.test.mjs`. It consumes an actual economy and an explicit diplomatic policy. In Test ship mode, up to six merchants trade between eight nearby port approaches, with native hull graphics, wakes, shadows and faction pennants. Exiting or regenerating terminates the worker and resets the temporary markets. Fit view releases Follow ship so the player can explore traffic. See [merchant traffic integration](docs/merchant-traffic.md).

Military vessels on the test map carry a small crossed-swords badge beside the hull. The badge stays upright and 23 screen pixels wide through zoom changes; frigates, war galleons and men-of-war show it, including the player trial vessel. Geometry is created once and follows interpolated ship positions, with offscreen culling and removal when traffic ends.


Men-of-war have `berthsRequired: 2`. Shared AI/player harbor traffic reserves both slots atomically and moors these ships broadside across the pier tip. Their mooring and outer approach use full turning clearance; docking, anchoring and departure routes allow for the rotating capital hull. Departure continues seaward from the pier-end mooring. FIFO queues keep later arrivals from claiming a side while an earlier capital ship waits for both; both reservations remain held until departure or anchoring completes. `tests/capital-docking.test.mjs` checks capacity, queue fairness, release, player docking and generated coastal maneuvers.


War galleons also reserve both berths and moor across the pier end. Every hull is assessed against side-berth turning and approach clearance; any unsafe hull/port combination uses the same pier-end mooring. The assessment and safe end positions are cached per port and hull size. Docking land contact, including an already grounded vessel, triggers an immediate 0.25–1 second eased slide to the verified end position, shared by AI and player docking. If another vessel occupies a side berth, recovery slides to the outer waiting position and queues for both slots without taking the occupied berth. Existing loading/unloading, ledger synchronization and departure behavior resume after recovery. `tests/dock-recovery.test.mjs` covers geometry-based selection, land-contact recovery, queues, AI service and worker-backed player docking; generated coastal maneuver tests cover both heavy hull classes.

Phase 0 foundations are implemented in `simulation-registry.js`, `simulation-settings.js`, `simulation-scaling.js`, `market-model.js` and `simulation-runtime.js`. See [the source audit and architecture notes](docs/phase-0-audit.md) for map-based timing, local market event boundaries, dynamic inventory registration and crew-based operating costs. Run `tests/phase0.test.mjs` for the foundation contract.

## Data catalogs

Game definitions now load from validated JSON catalogs. See [Phase 1 data assets](docs/phase-1-data-assets.md) for schemas, faction naming, renderer references and configurable manufacturing. Run `node scripts/validate-data.mjs` and `node tests/phase1.test.mjs` before changing a catalog.

## Modular ports

Phase 2A adds size-compatible berth allocation across dynamic docks and per-port governor expansion. See [dock infrastructure](docs/phase-2a-docks.md). Run `node tests/phase2a.test.mjs` for topology, allocation, construction funding and congestion-growth checks.

## Funded economy: Phase 2

Buyer-owned purchase orders commit available funds; owner-attributed offers preserve seller identity. Dockside acceptance settles payment and ownership immediately, while timed handling keeps paid goods unavailable until physically delivered. Whole-unit pickups, partial sales, retained cargo and explicit dumping preserve ownership and conservation. See [the Phase 2 contract and compatibility inventory](docs/funded-markets-phase2.md) and [integrated conservation report](docs/phase2-conservation-results.json). Run the funded-market, funded-market-priority, funded-handling and phase2-conservation tests.

## Browser benchmark

The development main menu has two one-click benchmarks with separate JSON reports:

- **Benchmark world gen** generates fixed-seed 32², 128², and 512² maps. It measures overview, land, water, and coast views with the simulation off, for about 3.5 seconds each including 1.5 seconds of warmup. It does not start a fleet.
- **Benchmark simulation** generates only the fixed-seed 512² map and starts 50 merchants. Once the fleet worker reports ready, it runs for 60 seconds: 30 seconds in the coast view at 1× and 30 seconds at 20×, each including 1.5 seconds of warmup. World generation and fleet startup happen before that minute. It does not run the smaller terrain scenes.

Both use fixed map settings. Keep the tab visible at one viewport size and browser zoom, then copy or download the JSON report. The report identifies `benchmarkType` (`world` or `simulation`) and includes device/browser details, frame median/p95, app ticker time, long tasks, generation time, and available JS heap. Simulation reports also include actual merchant count, worker tick time, and message samples. Browser frame intervals are not GPU timer measurements.

Where supported, both benchmarks collect per-scene GPU render time with `EXT_disjoint_timer_query_webgl2`. It measures the complete app render rather than only the terrain shader. World reports record `mapSettings.sizeSequence`; simulation reports record `mapSettings.size`. Earlier v4 reports mistakenly showed the menu's previous size in `mapSettings.size`, while each scene's `mapSize` was correct.

### Phase 3 coast-mask experiment, reverted

An experimental one-byte-per-hex coast mask replaced six neighboring terrain reads on beach pixels. Roads and industry markers already use the mutable `world.data` alpha channel, while biome classification uses the terrain channels already fetched by the shader, so caching those fields would add a texture read. The candidate mask would have cost 1 KiB, 16 KiB, or 256 KiB in both CPU and GPU memory at 32², 128², or 512², plus transfer and driver overhead. Its measured browser construction time was 0.6, 1.5, and 3.9 ms. Wind and water state were never cached.

In the fixed Brave run at 857 × 762 output pixels, paired coast scenes rendered identically across all 653,034 pixels at each map size. Median whole-render GPU times for mask versus original neighbor sampling were 9.59 vs 11.51 ms at 32², 11.14 vs 11.41 ms at 128², and 11.31 vs 11.21 ms at 512². Frame medians remained 16.7 ms throughout. The mask did not improve the largest map and added memory and generation work, so the candidate was reverted. The original road and industry update path remains authoritative, including construction, removal, and rollback.
