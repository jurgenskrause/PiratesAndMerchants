# Existing failure fixes

Small colony population presets previously replaced the initial dock selected by the faction infrastructure allocator with a small pier. This discarded terrain-validated deep-water access and prevented eligible capital patrols from spawning. Small presets now preserve the existing initial dock type while keeping the existing population, buildings and costs. All footprint, berth-size, hull-clearance and safe-spawn validation remains unchanged. No terrain is carved and no unsafe ships are forced into the map.

The restored deep-water access also makes the generated capital anchoring regression viable. The test now explicitly checks that its harbor accepts a capital hull and that its blocking reservation occupies a real berth before testing queued maneuver clearance.

The legacy logistics test instrumented a separate unversioned Ship module instance, while LogisticsEngine used a versioned dependency. It now resolves the Ship import used by the engine. Both stuck recovery and the existing 60-substep native integration parity check instrument the actual runtime class. Test expectations remain unchanged.

A colony regression asserts that small presets retain an assigned, terrain-valid deep-water quay. The existing military regression verifies exact faction quotas, safe hull poses, sailing, home/allied legs, density resizing and cleanup.

Validation: all 70 test files pass, including the three formerly failing files, startup, configuration, generation, capital docking, military traffic and observation invariance. Catalog schemas, references and assets validate successfully. Newly generated worlds receive the corrected dock allocation; already running worlds require regeneration. Arbitrary terrain can still prevent a safe hull/harbor placement, in which case spawning continues to skip unsafe locations.
