# Phase 3A: manufacturing audit and modular contract

## Active implementation

| Area | Authoritative path | Finding / transition |
| --- | --- | --- |
| Definitions | `dist/data/industries.json`, `catalog.schema.json`, compiled `catalog-bundle.js` | Four secondary recipes existed. Cannonballs and its foundry were missing. All secondary placement is disabled. The cannon recipe included wood; it now matches the approved iron-bars-only chain. |
| Registry | `simulation-registry.js`, `catalog-loader.js` | Definitions are detached, deeply frozen and validated in both Node and browser/worker startup. `manufacturingDefinitions` exposes the shared compiled contract. |
| Generated economy | `port-supplies.js`, `industries.js`, `merchant-session.js` | Generation permits one starting primary industry per port. `createPortEconomy` registers a factory only if a supplied world instance explicitly names one. There is no secondary construction/activation path. |
| Accounts | `economic-accounts.js`, `economy.js:configureIndustries` | Every legacy factory instance has `INDUSTRY:<encoded instance ID>` ownership and its own account. Existing initialization uses the configured industry grant. Later working capital must be a funded port transfer, not another grant. Reconfiguring factories is currently unsafe as a general live editing API and must not be used for definition changes. |
| Procurement | `economy.js:#refreshDemand`, `funded-market.js` | Legacy factories request one economic tick of inputs. Orders are funded, inputs enter industry-owned stores and inbound accepted goods remain unavailable. 3C must replace the fixed one-tick target with configured buffers and review timing. |
| Production | `economy.js:tick`, `goods-inventory.js` | A generic legacy loop converts a fractional recipe each economic update, with atomic input/output goods operations. It has no per-instance elapsed batch clock, active batch, capacity limits or output-cost carry. Outputs go straight to the local market. 3D replaces this loop, rather than running a second producer beside it. |
| Construction | `expansion-engine.js`, `infrastructure-governor.js`, `economy.js:purchaseInfrastructure` | Housing and docks consume owned materials without a separate gold charge. Industry construction, timed completion, placement and funded capital allocation remain 3B work. |
| Runtime configuration | `configuration-registry.js`, `runtime-configuration-owner.js`, compiled configuration | The live transaction owner supports selected navigation/trade settings; it has no industry-definition transition. Industry definitions are startup catalog configuration, not new live sliders. |
| Worker / inspection | `merchant.worker.js`, `port-economic-info.js`, `port-dashboard.js` | Read-only port reports expose legacy factory funds, goods, recipes and readiness. They now include the compiled manufacturing definition and identify `LEGACY_ECONOMIC_TICK` production. Full production progress and balancing controls remain 3I. |
| Prices / revenue | `funded-market.js`, `economy.js:#revenue`, `money.js` | Existing funded limits and eligible manufacturing worker shares apply. Legacy manufactured output has zero attributed input cost. Per-output cost attribution and enforced manufacturing price floors remain 3G. |

## Shared contract

`industry-contract.js` and its declarations provide:

- `validateManufacturingDefinition`: schema-complementing semantic validation, commodity references, buffer/capacity consistency, precision, priority and cost-weight checks.
- `compileManufacturingDefinition`: a detached immutable recipe, storage, construction, procurement and selling definition; no type-specific execution branches.
- `describeIndustryInstance`: stable instance/type IDs, parent port/catchment, account reference, separate store locations and initial construction/production state. This is a description, not account creation, inventory initialization or factory activation.
- `prepareManufacturingDefinitionChange`: validated preparation that rejects changed definitions in an active session.
- `INDUSTRY_PARAMETER_POLICY`: explicit units, ranges and session restart policy.

Instance identity is independent of type and parent port. `factory/one` and `factory/two` at the same port own distinct accounts. Inputs use `INDUSTRY:<encoded instance ID>`; planned internal outputs use `INDUSTRY_OUTPUT:<encoded instance ID>`. The latter is a new location contract for 3D, not an automatic relocation of legacy market output. GoodsInventory remains the only quantity authority; these descriptors contain no copied balances or inventory totals.

Production begins as `NOT_ACTIVATED`, elapsed time zero and no batch. Construction begins as `NOT_STARTED`, elapsed time zero and an unconnected parent-port reference. Subsequent phases supply the real state machine. `runtime_enabled` denotes the future batch lifecycle; its false value does not retroactively disable explicitly created legacy fixture factories.

## Parameters and units

All values live in the industry catalog and are validated at startup. All definition edits currently require **simulation restart**. There is no hot reload or live migration in 3A. Catalog edits must be compiled and deployed, followed by an app reload and a fresh worker simulation session. Existing inventories, accepted transfer terms, price locks and commitments are not rewritten. Economic/native runtime configuration remains separate.

| Parameter | Units / valid range | Provisional defaults |
| --- | --- | --- |
| `inputs`, `outputs` quantities | Cargo units, 0.000000001–1,000,000, at most nine fractional decimal places; nonempty, unique, registered commodities | Existing recipe quantities retained except cannon wood removal; cannonballs uses 1 iron bar → 2 cannonballs |
| `production_duration_seconds` | Elapsed simulation seconds, 0.001–31,536,000 | 10 |
| `input_buffer_targets` | Cargo units per input; at least one batch and no more than input capacity | Five batches |
| `input_storage_capacities` | Cargo units per input, same quantity range | Ten batches |
| `output_storage_capacities` | Cargo units per output, at least one batch | Twenty batches |
| `base_build_cost` | Positive registered material quantities; no gold field | Existing wood 40 and iron bars 10 |
| `construction_duration_seconds` | Elapsed simulation seconds, 0.001–31,536,000 | 60 |
| `working_capital_microgold` | Integer microgold, 0–9,007,199,254,740,991 | 1,000,000,000 units (1,000 gold), requested from the parent port |
| Procurement review interval | Elapsed seconds, 0.001–31,536,000 | 10 |
| Bid and maximum bid multiplier | Dimensionless, 0.01–100; bid cannot exceed maximum | 1 and 10 |
| Input priority | Exact permutation of recipe input commodity IDs | Recipe order |
| Selling review interval | Elapsed seconds, 0.001–31,536,000 | 10 |
| Ask multiplier | Dimensionless, 0.01–100 | 1.1 |
| Minimum markup fraction | Dimensionless, 0–10 | 0 |
| Cost floor policy | Boolean | True; enforcement is 3G work |
| Output cost weights | Positive weights keyed by outputs, sum to one within 1e-9 | 1 for the single output |

All tuning is explicitly provisional, including the new cannonball base price of 16 gold. Existing monetary storage and payments remain integer microgold; user-facing money uses the shared two-decimal formatter.

The legacy field name `quantity_per_tick` remains the single stored recipe quantity for compatibility. The compiled batch contract exposes that value as `quantity`; its production duration gives the intended batch timing. Until 3D, the legacy economic loop still uses the old per-economic-update semantics. Do not duplicate recipe numbers or infer a second balancing authority. In 3D the batch executor must replace that legacy loop and use the compiled duration.

Procurement and selling parameters are validated contracts for later increments, not hidden changes to current quotes. Aggregate worker share remains the existing global configuration, not another industry wage charge. Capital is a requested allocation, not an expense or automatically replenished balance.

## Final chains and supply gaps

| Industry | Inputs → output | Availability |
| --- | --- | --- |
| Distillery | Sugar + wood → rum | Sugar plantations are generated. Forestry is absent; wood currently has finite initial specialty stock only. Towns consume rum through the existing generic demand model. |
| Textile mill | Cotton → textiles | Cotton plantations are generated. Town and construction demand exists; shipyard demand does not. |
| Ironworks | Iron ore + wood → iron bars | Iron mines are generated; forestry is absent. Construction and configured foundries can consume bars. |
| Cannon foundry | Iron bars → cannons | Ironworks definition exists but no generated/built factory operates by default. Shipyards and real vessel orders are absent. Generic town consumption currently includes cannons as a legacy placeholder, not a completed shipyard consumer. |
| Cannonball foundry | Iron bars → cannonballs | Commodity and foundry definitions are new. `market_enabled:false` keeps cannonballs out of default market initialization, demand, merchant commodity lists and cargo reports until activation. No real shipyard consumer exists. The cannon icon is reused as a temporary definition asset. |

Food/farms, dedicated spice farms and forestry are not implemented primary producer definitions in the current catalog. SPICES exists as a commodity with finite opening specialty stock; FOOD is not registered. Primary generation currently covers cotton, iron ore and sugar. These gaps must be resolved in the appropriate supplier increments; 3A does not manufacture substitute resources or activate new chains.

## Verification

Focused tests cover all five chains, frozen registry output, schema and semantic failures, nanounit quantity precision, capacity and buffer relationships, microgold overflow, exact input priorities, cost weights, distinct instance owners/stores, multi-output modularity, Node/browser catalog parity and rejection of live definition changes without touching balances, goods or orders. Existing conservation, goods ownership, funded market, configuration, worker, inspection and icon tests verify compatibility.

Phase 3A completes the definition/contract foundation. Industry construction, configured procurement, timed batches, internal output handling, cost attribution, price floors, autonomous investment and their UI are remaining work; secondary-industry operation is not declared complete.
