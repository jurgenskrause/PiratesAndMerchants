# Development build workflow

Opening menu → Options → Apply and return → World Gen → Generate world → Simulate.
There is no automatic generation or player launch. Graphics initialize behind the
menu. Simulation hides generation settings and starts the existing traffic worker
with player=null. Hover, pinned ship inspector, fleet list, economy and patrols
remain available in observer mode. Adjust simulation holds live wind, traffic,
port selection, route debug, recovery and faction threat/diplomacy controls.
Simulation speed stays in the bottom HUD.

Launch own vessel adds the existing sea-trial ship. Withdraw, Escape and class
changes do not stop/restart the fleet worker. The worker receives player pose or
null through its existing message protocol. Main menu and World Gen end the test
session; returning to the menu is not a game save. Options remain selected only
in this tab. Configuration edits require a fresh generated world before Simulate.

The registry generates the existing developer setup panel. Phase 1C connects all 43 current definitions through compiled owner settings. World edits require generation/restart; application settings remain local. Invalid candidate batches are rejected atomically and warnings remain nonblocking. See configuration-migration.md for consumer coverage, authority and the planned runtime activation boundary. No player options screen or game-state saves are included.

Phase 1D adds JSON batch controls under Adjust simulation. Application preferences activate before rendering; the six documented live world keys activate before simulation updates. Other world edits stage a restart or regeneration. See runtime-configuration.md.
