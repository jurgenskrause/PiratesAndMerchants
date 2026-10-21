# Phase 1A: configuration foundation

Phase 1C now connects all current definitions through compiled subsystem settings. See
`dev-build-workflow.md` for current integration; the non-integration section below
records the original Phase 1A boundary.

## Authority and scope

`dist/data/configuration_definitions.json` defines 31 initial settings. Definitions
are schema checked through the existing catalog loader, then semantically checked
by `ConfigurationRegistry`. Numeric step alignment is measured from min, using a
bounded floating-point tolerance. Integers must be safe integers. NaN, infinity,
negative zero, coercion and clamping are rejected. Enum choices are unique strings.

`configuration_overrides.json` is the developer selection file; currently empty.
It may contain both scopes. `selected()` validates and defensively copies it.
`resolve()` validates every selected key, then projects the requested scope. A
valid application selection is deliberately excluded from a world snapshot.
Unknown keys fail even when they would belong to another scope.

Definitions and selections are separate from complete effective snapshots. There
is no mutable singleton holding active values. Definitions, selections, snapshots
and nested values are frozen copies. `user_settable` describes future UI exposure;
`permission` describes future authorization. This phase does not implement an
actor-authorized editing endpoint or runtime activation.

Application scope means presentation only. World scope means simulation outcomes.
The generator worker captures a world snapshot at generation. Worker transfer
removes JavaScript freezing, so `SimulationRuntime` reconstructs/validates a fresh
immutable copy when one is present. Headless/new sessions without a generated
snapshot resolve a fresh session. A snapshot never changes when defaults change.

## Deliberate non-integration

No gameplay consumer reads these selections yet. Existing `systemSettings`,
constructor defaults and constants remain operational. Capturing a selected value
is NOT applying it. This temporary duplication is tracked in the inventory and
ends in Phase 1C. There are no save files, networking, options screen or hot reload.
Phase 1A introduces no simulation balance changes.

## Wire format

A snapshot is exactly `{format_version:1,revision:<nonnegative safe integer>,
scope:"application"|"world",values:{<every ID in that scope>:<scalar value>}}`.
Revision is supplied by the caller, not inferred from clocks. Canonical encoding
is compact JSON: object keys recursively sorted by JavaScript lexical order,
arrays retain order, no whitespace, and numbers/strings use JSON.stringify's
encoding. Values are only finite numbers, booleans or strings. This is a project
wire format, not a claim of RFC 8785 compatibility. Serialize validates first.
Deserialize rejects unknown versions, extra envelope fields, missing settings,
extra/wrong-scope settings and invalid values. Duplicate textual JSON keys are
subject to JSON.parse's last-key semantics; this is not an untrusted network
protocol. Future networking should choose a stricter parser if needed.

Complete snapshots round-trip independently of changed defaults, provided IDs
and validation remain compatible. There is no migration engine now. Future game
saves must embed complete world snapshots plus simulation-rules/save versions;
configuration snapshots alone cannot preserve old algorithms. Renames/removals
must eventually have explicit migrations rather than silent aliases/clamping.

## Intended Phase 1C compilation interface

Compile once from an accepted immutable snapshot into fixed-shape readonly objects:
`compileEconomySettings(world)`, `compileLogisticsSettings(world)`,
`compileNavigationSettings(world)`, `compileRenderingSettings(application)`.
Return `{revision, ...directFields, ...precomputedDerivedFields}`. Typed contracts
must describe those fields. Systems receive these objects through constructors;
inner loops use direct numeric fields or tick-local copies, never ID lookup.
Compilation must not invent fallbacks. The registry owns setting defaults; ship,
commodity and settlement registries retain entity-specific definitions.

## Phase 1B handoff

Reuse `ConfigurationRegistry`, its definition schema and selected-value validation.
Add complete-candidate batch validation and structured diagnostics. Keep simple
relational operators in a bounded constraint catalog and complex invariants in
subsystem validators. Validate compiled default candidates before integration.

Investigate at least: secondsPerDay/economicTickSeconds producing integer daily
accounting intervals; physics dt remaining inside current runtime limits; threat
threshold versus max threat; recency versus maximum patrol age; feasible fleet
limits; map size and road search budgets. Ranges in the catalog are proposed
individual bounds, NOT a claim that every combination is safe.

No next_tick settings are marked live-safe yet. World definitions are restart or
new-world only; future phases can promote them after proving transition safety.
`next_frame` applies only to a proposed presentation setting, not current controls.
