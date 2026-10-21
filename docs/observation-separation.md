# Observation and simulation ownership

DockTraffic.update() owns RESERVED -> APPROACHING and WAITING_DEPARTURE -> DEPARTING transitions and admission wait recording. BridgeLogistics calls it each physics update; mutating harbor commands also call it after completing their changes, so local player docking and standalone harbor callers do not require an observer to grant admission. Reservation insertion order provides deterministic arbitration within each harbor. advanceTick updates the harbor clock and invokes the same updater.

DockTraffic.get() is a pure, detached reservation view. queueStats() filters its requested time window without deleting history. Admission history remains bounded to the existing 32 samples per port. A tooltip requesting a shorter window cannot change the infrastructure governor's later congestion calculation.

PriceLedger.knowledge() filters expired reports without deleting entries, and returns detached reports. Actual expiry is maintained by the existing bridgeTick pruning of port, player and ship ledgers. Mutating ledger synchronization also retains explicit destination maintenance. merge() excludes entries expired under either ledger's lifetime and never prunes its source ledger.

getAgentState(), the worker's ship details, player ledger display and reservation publication consume these read-only views. Publication clocks and destructive infrastructure outbox delivery remain adapter concerns; draining that outbox acknowledges transport delivery and does not advance docking or economic state. Pure display reads must not be used as maintenance triggers in future features.

## Verification

observation-separation.test.mjs checks command-driven queue admission and departure, repeated inspection without state changes, detached nested reservation and ledger fields, non-destructive statistics windows, explicit expiry and non-mutating source merges.

Three identical two-merchant, two-port simulations run 18,000 physics steps each with observation disabled, once per second and every tick. They include completed voyages and compare ship state/positions, wallets, manifests, orders, voyage histories, ship and port ledgers, market supplies, reservations and waiting history. All outcomes are identical. Planning work uses a fixed iteration budget so machine scheduling does not confound the comparison.

Focused docking, capital docking, berth hexes, dock recovery, infrastructure and physical voyage regressions pass. Catalog/schema/assets validation passes. Full suite: 67 files passed; the same three pre-existing failures remain in anchoring.test.mjs:37 (military docking request), logistics.test.mjs:40 (recovery expectation), and military-traffic.test.mjs:16 (war-galleon quota). No new failures.

A representative 300-step headless fleet check completed for 30 merchants plus 3 patrols and 100 merchants plus 24 patrols. Current median/p95 step costs were 0.94/8.36 ms and 6.31/11.89 ms respectively. The prior source measured 1.00/8.72 ms and 6.14/10.92 ms in the same harness. These single-run timings are a smoke check, not evidence of a performance gain. The smaller fleet retained identical ship/economy checksums. The larger fleet changed checksums because deterministic harbor admission now happens on commands/ticks rather than whichever reservation an observer reads first. This intended ownership change preserves the observation-frequency invariant within the new implementation.

## Handoff

Snapshot publication frequency can now be optimized independently of harbor transitions and ledger maintenance. Keep all ships on the same simulation update schedule. Changes to payload frequency, differential publication and UI caching are separate future work.
