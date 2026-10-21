# Phase 1C: goods ownership and location

GoodsInventory is the authoritative physical inventory. Port stock values and ship
manifests are projections, not independent quantities. Economic accounts identify
owners; owning goods does not require an owner to have spendable money.

## Ownership and location map

| Goods | Economic owner | Physical location | Availability |
| --- | --- | --- | --- |
| Opening trade stock, including historical manufactured/imported stock | Parent PORT account | MARKET:port | Available for funded purchase unless reserved |
| Primary production | Parent PORT account | MARKET:port, or existing configured TOWN production pool | Only the designated pool can use it |
| New manufactured output | Individual INDUSTRY account | MARKET:parent-port | Sold on behalf of that exact instance |
| Purchased town supplies | Buying PORT account | TOWN:port | Consumable locally, excluded from merchant stock |
| Purchased manufacturing inputs | Buying INDUSTRY account | INDUSTRY:instance | Available only to that factory's recipe |
| Unsold merchant cargo | MERCHANT account | SHIP:vessel | Remains aboard until funded sale, explicit loss or retirement |
| Imports bought by a port | Buying PORT account | MARKET:destination | Subsequent revenue belongs to that port, not a local factory |
| Construction materials held in a market | Parent PORT account | MARKET:port | Tagged with reservation ID and excluded from trading, allocation and manufacturing |
| Fulfilled construction materials | Same PORT account | CONSTRUCTION:reservation | Still physically present and reserved until explicit construction consumption |
| Generic counterpart inventory used in headless tests | Explicit fixture account | ACCOUNT:owner | Finite initialized quantities; absent from active merchant sessions |

Identifiers encode their owner/location IDs using the same stable account convention.
The location contract also names TRANSFER for a physical committed transfer. The
current timed handling completes one batch per callback, so it needs no persistent
TRANSFER lot. Ownership still changes with the payment at each completed handling
batch. Price quotes remain price locks, rather than reservations of goods or funds.
This does not introduce Phase 2 docking-time settlement.

## Representation and inspection

A live record stores owner account, location, commodity, quantity, origin port,
aggregate acquisition cost, contraband status and optional reservation ID. Records
coalesce when these identity fields agree; different acquisition prices are combined
by their total cost, not retained as a new lot per handling tick. Empty records are
removed. Different factories remain separate because their owner accounts differ.
Different cargo origins remain separate, with weighted commodity totals exposed in
compatible manifests. A mixed-origin manifest has a null aggregate origin and an
explicit provenance array; turnaround return guards use every origin in that array.

Records grow with actual distinct owners, locations, origins and outstanding
reservations, not elapsed ticks. There is no permanent goods-event archive. Bounded
developer price history combines provenance by owner/origin within its existing
bounded handling events. Cumulative source/sink counters use fixed operation
categories. Floating remnants below the existing cargo handling tolerance, and
quantities too small to survive a floating-point merge, are explicitly recorded as
rounding-dust removal rather than keeping a berth occupied indefinitely.

`getGoods`, `getGoodsSnapshot`, stockpile `ownership` and manifest snapshots are
read-only. Snapshot totals satisfy, per commodity:

`physical total = opening inventory + recorded creations - recorded removals`

Recipes conserve their stated input/output relationship, not equal unit counts
between different commodities. Local moves and reservations preserve physical
commodity totals and do not generate money.

## Initialization and manufacturing

Existing aggregate opening stock has no historical producing-instance identity.
It is explicitly assigned to its parent port as opening population stock. It is not
retroactively assigned to whatever factory happens to exist locally. New factory
output always belongs to its producing instance. `initializeInventory` supports
explicit owned opening quantities and acquisition cost while initialization is open;
it cannot replenish stock after initialization closes. Configuration continues to
control capital amounts without introducing grants or top-ups.

Primary-production rates create port-owned quantities in their existing configured
pool. Each manufacturing instance buys only the missing inputs for one existing
recipe tick, paying the selected market owners through Phase 1B into its private
input store. It then removes its own inputs and creates its own output, allowing
existing fractional batches. Unconsumed purchased inputs remain private. A factory
with no funds or inputs stalls. The existing industry working-capital default remains
zero; fixtures that exercise production explicitly fund it. No new buffer targets,
purchase orders, wage splits, price rules, expansion or shipbuilding were added.

Town consumption removes only town-owned internal quantities. Governor allocation
moves only the town's own unreserved goods. It cannot confiscate a factory's output
or another port's stock; those quantities must be purchased through settlement.

## Settlement and API changes

Purchases select actual available owner records and split gross proceeds between
those owners in proportion to the quantities loaded. Explicit `sellerAccountId`
restricts selection to that seller. The existing tax treatment remains until 1D.
Deliveries debit the identified funded buyer and transfer actual seller-owned cargo;
a fabricated manifest or a seller without owned quantities cannot mint market stock.
The Phase 1B rollback covers accounts, inventory, manifest, journal and price-quote
progress. Payment observers see the completed batch. Idempotent replay never moves
another copy of the goods.

`depositCargo` is now an explicit move from an identified owner's physical location,
not a quantity-creation API. Missing source ownership is rejected. Its optional
recipient identifies an explicit gift/disposition, not a paid sale. `transferStock`
moves only the origin town's own unreserved stock and retains that owner at the new
market; it cannot move a factory's goods for free. The compatibility trickle caller
uses this same ownership-limited path.

`receiveExternalCargo` is the declared external-capture source for the existing
capture/test integration hook, with owner, ship location, origin and acquisition
cost. A future capture system linking two simulated ships must transfer those exact
source quantities rather than call this external source hook after separately
removing the same goods.

## Construction, losses and lifecycle

Reservation tags partition existing stock. On fulfillment, the tagged quantity moves
to its explicit construction buffer and is counted exactly once. Cancelling an
incomplete reservation releases its remaining market hold; previously fulfilled
materials retain their ownership and location. `consumeConstructionMaterials`
records actual material use. Existing immediate infrastructure construction removes
only the port's own unreserved materials, recording construction use alongside its
existing success/failure rollback. Its faction gold expenditure remains a documented
legacy financial sink, pending a defined construction recipient.

Ship spoilage removes the merchant's quantities proportionally across provenance
records. Dumping discards cargo and records the loss; it neither produces market
stock nor generates payment. Existing interdiction removes cargo with an explicit
confiscation/sinking reason until a recipient is simulated.

Fleet reduction no longer deposits a second copy of each manifest. Account retirement
moves remaining goods once to the registration port, with that port becoming owner;
account funds and goods disposition commit/roll back together. If no destination
port exists, cargo loss is explicitly recorded as actor removal while money follows
its existing faction recipient. Removed industries surrender their remaining input
and output quantities to their parent port. Full restart creates a separate session
with new opening inventories and funds, not transfers into the old session.

## Verification

`goods-ownership.test.mjs` covers mixed ownership, separate identical factories,
owner-specific seller selection, funded manufacturing, imported resale, partial
loading/unloading, multiple origins and weighted acquisition costs, read-only history,
reserved materials, protected local allocation, construction use, spoilage, dumping,
settlement rollback, actor retirement and bounded coalescing over 500 round trips.

Existing cargo, price-lock, berth, voyage, construction and worker/session tests are
retained. Test fixtures now declare finite opening goods as well as funds; direct
manifest fabrication has been replaced by explicit capture-source setup.

Final validation: all 85 test suites passed, including simulation soak, generated
voyages, price locks, merchant turnaround, worker/session and construction checks.
Catalog validation, module-version checks and `git diff --check` also passed.

Gold conservation is still incomplete because the Phase 1B report's legacy overhead,
faction upkeep and construction expenditures remain. This phase does not claim to
complete Phase 1D revenue distribution or Phase 1E running-cost purses.
