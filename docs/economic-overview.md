# Developer economic overview

Start a simulation, then select **Economic overview** beside **Active ships** in the bottom map controls. Choose a resource from the commodity registry. Each port has a price line and a checkbox to show or hide it. Ports are grouped by faction, then alphabetically by name. Lines and swatches share the faction’s pennant color, which remains readable on the dark chart. The timeline covers the whole run or the last 5 or 20 simulated minutes.

The graph shows local spot prices before tax as steps, since prices change when market operations occur. Delivery circles and pickup triangles identify cargo handling. Hover a change or marker to see ship ID/name, quantity, handling interval, delivery source or pickup destination, before/after market price and average actual payment including tax. A recent-movements table presents the same information without requiring pointer precision. Exact retained batch samples also show the selected batch's quantity and price change. Background market updates are labelled separately and never attributed to a ship.

Purchase requests lock the unit price but do not reserve or deduct the requested stock. Actual stock and spot prices change on each loading or unloading batch, not once at request or delivery completion. Production, manufacturing, allocation and reservations can also change spot prices between batches. The chart preserves these actual changes rather than moving them to an artificial single transaction time. Locked loading quotes remain unchanged. The graph's rising spot price during a pickup does not imply that later batches are charged more: the tooltip's average payment reflects actual executed transactions. Delivery provenance comes from the cargo manifest, not the ship's last stop, so intermediate water stops do not rewrite cargo origins.

## Observation and lifetime

`EconomicHistory` subscribes to immutable, post-commit market events in the simulation worker. `EconomicEngine` adds optional transaction metadata without changing prices, stock deductions, taxes, return values or quote rules. Both active bridge merchants and the legacy logistics adapter supply actor/source/destination metadata. Trades without actor context are labelled unidentified.

Recording starts when the simulation is initialized and continues while the overview is closed. History is session-local and resets on simulation restart or world regeneration. Live configuration edits retain the same history. Merchant ledgers cannot access this global developer telemetry.

The main thread requests only the selected resource, once per real second while the dialog is open, with no overlapping request for the same resource/session. Snapshot requests neither advance time nor alter state. Stale sessions and responses from a previous resource selection are ignored. Errors in an observation request do not stop simulation updates.

## Performance bounds

Each port/resource retains at most 2,048 recorded samples plus a synthetic current-time endpoint, and 256 handling operations. Older samples compact in chronological groups, preserving initial price and price extremes; recent samples remain exact. The UI announces compaction and expired operation details. Expired cargo details are explicitly identified rather than inventing attribution. This is bounded diagnostic history, not a durable transaction archive.

An index groups continuous batches from the same ship, action, origin and destination, separated by no more than 2 simulated seconds. Concurrent ships remain distinct. No fleet scan or registry lookup is added to physics or steering. Graph drawing uses Canvas2D and is limited to the open dialog.

## Verification

Tests cover initial prices, locked-quote pickups, manifest-origin deliveries, actual merchant attribution, overlapping handlers, invalid resources, bounded storage, extreme-price retention, detached nested snapshots, observation parity, paused worker reads, session resets, resource changes, port filtering, step lines, markers, tooltips, stale responses and keyboard closing. Existing economy, quote, docking, sailing, startup and observation regressions also run.

A counterbalanced headless check with 100 merchants and their patrol fleet produced identical ship/market hashes with and without recording. Selected-resource snapshot creation was approximately 0.4–0.5 ms and 198 KB after 600 updates in that scenario. Overall fleet timings were noisy under concurrent regression testing, so they do not establish a browser FPS improvement or a precise overhead percentage.
