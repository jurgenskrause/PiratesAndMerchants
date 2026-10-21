Phase 1C integration is documented in configuration-migration.md. The original Phase 1B boundary below is retained as implementation history; all current definitions now have consumer bindings.

# Phase 1B: complete configuration validation

Definitions, overrides and snapshots retain the Phase 1A format. Canonical serialization remains recursively key-sorted JSON, with format_version 1, revision, scope and complete values. Constraints and diagnostics are not serialized into snapshots. Reconstructed snapshots are checked against the currently installed validation catalog; there is no save migration or persistence layer.

## Established rules

| ID | Severity | Source and rationale |
|---|---|---|
| economy.whole_ticks_per_day | Error | `economy.js` requires ticksPerDay to be a positive safe integer. `port-supplies.js` derives it as secondsPerDay / economicTickSeconds. The interval must divide the day. |
| navigation.threshold_within_cap | Error | `bridge-logistics.js` rejects a threat threshold outside the threat grid cap. |
| economy.accounting_counter | Error | Economy-owned defense against non-finite, non-positive or unsafe derived tick counters. Current scalar bounds already prevent these; protects future range changes. |
| logistics.supported_fleet_limit | Error | `merchant-session.js` currently caps test merchant density at 100. The owner module now exports that same constant for validation. Larger registry selections require consumer migration and profiling. This does not change the current fleet limit. |
| threat.recency_cutoff | Warning | `threat-grid.js` clips the recency window to maxPatrolAge. Exceeding it is supported, but the requested protection window is truncated. Replaces the developer panel's unnecessarily hard check. |
| simulation.economic_step_alignment | Warning | The accumulator accepts fractional physics-step alignment; execution occurs on an update boundary. Exact alignment is useful, not mandatory. |
| navigation.hotspot_trigger | Warning | `ThreatGrid.corridorHotspots` uses a strict greater-than comparison. A threshold equal to the cap disables that trigger. |

All current defaults remain valid. No balance, navigation algorithm or runtime activation changes are included.

## Declarative catalog

`data/configuration_constraints.json` uses schema-validated IDs, setting references, severity, message and operator arguments. Initialization rejects unknown operators, unknown references, duplicate references/IDs, wrong arity/types, invalid arguments and cross-scope relationships. The bounded operators are:

- `less_than_or_equal`: two numeric settings, no arguments.
- `integer_multiple`: numeric numerator and positive denominator, no arguments. Uses a bounded floating-point tolerance.
- `compatible_timing_intervals`: interval and step; mode `whole_steps` or `bounded_step`. Both must be positive and step cannot exceed interval.
- `mutually_exclusive`: two or more booleans; at most one true.
- `required_when`: condition and target; `equals` and `required_value` are validated against their definitions. Exact scalar equality only.

No executable expressions or arbitrary asset-defined callbacks are evaluated. Required-when and mutually-exclusive are tested with fixture settings; no unsupported production relationship was invented merely to exercise them.

## Owner validators

Economy, logistics and navigation supply descriptors from their own `*-configuration-validator.js` modules. Each descriptor declares a stable ID, scope, referenced keys and a synchronous `validate(values)` function. Registry coordination passes only the deeply frozen projection of declared scalar values, never a world or simulation instance. Results contain severity, message and optionally a subset of declared keys. The registry attaches validator ID and source. Exceptions, asynchronous results and malformed diagnostics become blocking failures.

Purity is a trusted-code contract, not a JavaScript security sandbox: validators must not capture or mutate simulation state. The current validators have no stateful dependencies. Frozen inputs prevent accidental configuration mutation.

## Candidate API and atomicity

```js
const result = configurationRegistry.validateBatch(activeSnapshot, {
  'navigation.threat_threshold': 70,
  'threat.max_threat': 80
});
if (!result.ok) report(result.errors);
else inspect(result.candidate, result.warnings);
```

A batch overlays all edits on the existing complete snapshot, then validates the candidate. No partial candidate is returned on failure, and the active snapshot and caller edits are unchanged. Successful candidates are deeply immutable and default to active.revision + 1. Revision assignment is bookkeeping, not runtime activation.

`validateSelections(overrides)` resolves both scopes from defaults for developer setup, returning selected overrides and a session only on success. `validateSnapshot` checks transferred full envelopes. Diagnostics contain id, setting_ids, severity, message and source; errors and warnings are separate immutable arrays. `resolve`, `reconstruct` and deserialization also enforce full validation and throw ConfigurationValidationError on hard failures. `selected` only validates individual partial fields and is not an activation API. Developer Apply uses complete validation and reports nonblocking warnings in the setup status.

There is no per-tick resolver overhead: validation runs during initialization, editing or reconstruction. Existing compiled fixed-shape consumer objects remain the hot-path interface.

## Outstanding domain rules

No hard procurement-versus-ledger expiry relationship is established by the current engine. Map-scaled timings, polar-profile relationships and safe limits beyond 100 merchants need owner investigation before constraints or ranges are changed. Untapped foundation settings still need consumer migration; accepted selection does not imply that every existing subsystem reads it yet. Cross-scope constraints are intentionally disallowed to keep local presentation from affecting world outcomes.

## Exact handoff for subsystem integration

1. Keep these validation APIs as the candidate boundary. Owners add pure validators in their subsystem modules and register descriptors at registry composition, with source evidence for every hard rule.
2. Compile only successful immutable world/application candidates into fixed-shape, typed, read-only owner settings objects. Do not add string-key lookups to physics or cargo inner loops.
3. Inventory each remaining consumer, preserve default behavior, and migrate in bounded groups. Existing 12 developer controls already have explicit consumer bindings.
4. Design activation separately: stage validated candidates, apply complete revisions at declared frame/tick/restart/new-world boundaries and swap owner objects atomically. This phase does not activate runtime edits.
5. Add integration tests for each migrated owner and retain candidate atomicity, scope separation and canonical round-trip tests. Save compatibility and multiplayer authority remain future work.

## Verification results

Passed: configuration-foundation, configuration-validation, dev-workflow, startup, phase0, phase1, economy, merchant-traffic, bridge-generated and simulation-optimization. Catalog schemas, cross-references and asset existence checks passed; git whitespace checks passed. Tests cover all five operators, malformed definitions, startup rejection, coordinated edits, warnings, immutable owner inputs, wrong-scope edits, asynchronous validator rejection, serialization and unchanged active snapshots. Visual browser QA was not run for this backend validation phase.
