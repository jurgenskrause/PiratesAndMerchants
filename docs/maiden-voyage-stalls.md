# Shared fleet stalls during maiden voyages

The active merchant worker also advances military vessels. Periodic economic updates ran synchronously before navigation and snapshot publication. On the default TRADEWINDS 256 map, profiling seven economic updates measured 1.12–1.43 seconds of blocking per update. The independently simulated player vessel continued moving.

Goods creation, movement and consumption copied the full inventory for each small operation. Queries repeatedly scanned unrelated goods and market offers. Manufacturing also refreshed every port's stock after each factory's output.

The correction uses owner/location/commodity/reservation indexes, a journal of touched goods for local rollback, and indexed local market books. Whole-settlement checkpoints remain available and rebuild their indexes on restoration. Nested conversion failures restore quantities, acquisition costs, provenance, recorded flows and record ordering. Manufacturing refreshes only its affected outputs. Book restoration and cancellation keep their local indexes consistent. Prices, funding, physical handling and simulation clocks are unchanged.

The equivalent 70-second worker run measured a maximum step of approximately 0.20 seconds after the change, versus approximately 1.43 seconds before. Measurements are machine-dependent; they are evidence of reduced blocking, not a guarantee of frame rate on every device.

Regression coverage includes native merchant and military motion across the first economic update, nested goods rollback without global inventory copies, index restoration, funded acceptance, handling, material construction, running-cost purses and exact microgold conservation. The integrated scenario retains 4,500 gold with zero unexplained money or goods changes. Interactive browser verification was unavailable in this environment.
