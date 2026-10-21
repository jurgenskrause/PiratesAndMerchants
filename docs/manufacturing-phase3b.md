# Phase 3B: material-funded factory construction

The active worker's `BridgeLogistics.industryConstruction` owns placement and time. `EconomicEngine` owns project commitments, physical materials and factory accounts. There is no automatic factory investment decision in this increment.

## Lifecycle and ownership

| Stage | Materials | Working capital | Factory |
| --- | --- | --- | --- |
| Requested | Validate unreserved port-owned market stock, including its retractable automatic offers | Validate spendable port treasury | Validate configured secondary type and a deterministic safe site |
| Building | Move existing materials to `CONSTRUCTION:<project ID>`, owned by the port, reserved as `BUILD:<project ID>` | Reserve `CAPITAL:<project ID>` inside the treasury | Reserve site and access path against urban expansion; create a zero-balance future industry account |
| Complete | Consume exactly the configured quantities, recorded as `removed:industry construction` | Transfer the committed microgold to the individual industry account | Place one factory, connect to one parent port, initialize its separate input/output store descriptors |
| Removed | Return surviving industry goods to the parent port's market; retain provenance, clear original manufacturing revenue eligibility | Sweep remaining account money to the parent treasury; retire the account with zero balance | Remove factory marker and industry metadata; close its road endpoint, retain reusable shared road infrastructure |

Construction has no gold charge. Working capital is an investment transfer, not a grant, wage or construction expense. No top-ups occur. The industry account exists unfunded while building and receives its configured capital only on completion. Initialization must already be sealed.

Each identity uses the stable project ID and `factory:<project ID>` instance ID. Accounts use `INDUSTRY:<encoded instance ID>`. Input stores use `INDUSTRY:<encoded instance ID>` and output stores use `INDUSTRY_OUTPUT:<encoded instance ID>`. Empty stores are represented by their descriptors, not zero-quantity goods records. Factories of the same type have independent accounts and inventories.

Capital and materials come from the Phase 3A definition. Current provisional defaults request 40 wood, 10 iron bars, 60 simulated seconds and 1,000.00 gold working capital. Definition edits take effect on a new simulation session.

## Funded acquisition and limits

Construction only accepts available **port-owned market materials**. It cannot take a merchant's or factory's stock, goods listed in an explicit offer, an accepted pickup/delivery, or another construction project's reservation. It retracts the port's own automatic offers before reserving its goods.

When materials belong to another owner, the existing funded purchase order and offer settlement must acquire them first. Port purchases arrive in town storage. The existing town-to-market allocation moves them into construction supply without payment or duplication. Insufficient materials or capital rejects the start without any changes; the developer controls never create funds or materials.

World generation's one-starting-industry-per-port limit remains intact. Construction does not consult that starting allowance. All five configured secondary types can be constructed. This does not activate their production or procurement: new instances report `NOT_ACTIVATED` and are excluded from the legacy economic-tick factory executor. Cannonballs remain disabled for market trading until their later activation increment.

## Safety and catchments

Acceptance rolls back goods, offers, account creation, capital commitments and site reservations together if any step fails. Completion couples the capital payment, material consumption, factory metadata, terrain marker and roads through the accounting effects transaction. An injected failure after placement restores all of them. Observers run only after commit.

Completion revalidates the site and access route. Placement failure keeps the existing project, its reserved materials and its capital commitment, and reports the error for retry at most once per simulated second. A completed callback cannot consume or fund a second factory.

New feeder roads cannot traverse or approach within one hex of foreign catchment roads, town cores, town quarters, dock land or buildings. Pending factory routes are included in this protection. Routes connect only to the designated parent port's reciprocal road network. Shared trunks within one catchment remain supported.

Removal rejects open offers/orders, reserved goods and unfinished accepted deliveries. Callers must cancel unaccepted listings/orders and finish accepted handling first. Building projects cannot be removed through factory decommissioning; their obligations remain live until completion. The entire simulation restart opens a new accounting session and returns to the original generated world, rather than redistributing balances from the retired session.

Construction metadata retains live buildings/projects and up to 128 removed-project records. Retired zero-balance account identities remain in the authoritative account registry. Payment and trade histories retain their existing bounded policies. Public inspections return detached nested instance data. Legacy whole-industry reconfiguration and direct account retirement cannot bypass the construction lifecycle while constructed instances are present.

## Deterministic developer access

Open **Developer → Factory construction**, choose a port and factory type, then use **Start material-funded construction**. The engine selects the closest eligible tile, breaking ties by tile index. **Inspect projects** reports state, elapsed time, identity and placement errors. The port dashboard also shows factory projects and completed inactive factories. The worker sends authoritative industry/road updates to the map; stopping or restarting restores the original map replica.

Headless callers can exercise the same engine directly:

```js
const construction = session.logistics.industryConstruction;
construction.start({id: 'exercise-one', portId, typeId: 'rum_distillery'});
construction.start({id: 'exercise-two', portId, typeId: 'rum_distillery'});
// Advance the normal SimulationRuntime; no instant completion shortcut.
```

An explicit `{q, r}` site can be supplied for a deterministic placement fixture. Stable duplicate IDs return the existing matching project; conflicting reuse is rejected. Worker developer requests require the current session and configuration revision. Failures return to the panel without stopping the worker.

The default world may have no available iron bars at a chosen port. The panel reports that shortage. It does not seed stock to compensate for production chains that are intentionally not yet active. Tests use explicit initialization inventory fixtures or funded material purchases.

## Verification

`industry-construction.test.mjs` covers two distilleries with separate accounts/stores, owned material and capital reservations, funded foreign-owned materials, injected acceptance/completion failures, duplicate completion, configurable and zero capital, step-size equivalence, read-only inspection, protected accepted deliveries, removal disposition and isolated feeder roads.

The integrated fixture opens with 5,000.00 gold, consumes 80 wood and 20 iron bars for two factories, and closes completion with 3,000.00 in the port treasury and 1,000.00 in each factory. Initialization grants do not change. Account totals stay exactly 5,000,000,000 microgold, with no construction charge or unexplained goods loss.

`industry-construction-worker.test.mjs` exercises the real worker, elapsed construction time, duplicate request IDs, stale revision rejection, paused read-only inspection, funded factory completion, map update publication, conservation and clean simulation restart. Existing account, funded-market, goods-ownership, construction, generation, navigation and runtime-configuration regressions remain covered. Browser visual QA is unavailable in this environment.
