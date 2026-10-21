// Shared with merchant-session: the currently supported engine traffic limit.
export const SUPPORTED_TEST_MERCHANT_LIMIT=100;
export const logisticsConfigurationValidator=Object.freeze({
 id:'logistics.supported_fleet_limit',scope:'world',setting_ids:Object.freeze(['fleet.max_test_merchants']),
 validate(values){return values['fleet.max_test_merchants']>SUPPORTED_TEST_MERCHANT_LIMIT?[{severity:'error',message:`The current traffic engine supports at most ${SUPPORTED_TEST_MERCHANT_LIMIT} test merchants. A larger limit requires consumer migration and profiling.`}]:[];}
});
