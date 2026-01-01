/**
 * @file TestRunner.gs
 * @description Main runner to execute all service connection tests.
 */

/**
 * Runs all connection tests and logs the results.
 * This is the main entry point to be executed from the Apps Script editor.
 */
function runAllTests() {
  const logger = BetterLog.getCloudLogger();
  let allTestsPassed = true;
  const results = [];

  // --- Add new service tests here ---
  const tests = [
    testHubspotConnection,
    testGammaConnection,
    testSkyvernConnection
  ];
  // ------------------------------------

  logger.log('Starting all connection tests...');

  tests.forEach(testFunc => {
    try {
      const result = testFunc();
      logger.log(result.message);
      results.push(result);
      if (result.status === 'FAILURE') {
        allTestsPassed = false;
      }
    } catch (e) {
      const failureResult = {
        service: testFunc.name.replace('test', '').replace('Connection', ''),
        status: 'FAILURE',
        message: `[${testFunc.name}] Critical error during execution: ${e.toString()}`
      };
      logger.log(failureResult.message);
      results.push(failureResult);
      allTestsPassed = false;
    }
  });

  const finalMessage = allTestsPassed
    ? '✅ All service connection tests passed successfully.'
    : '❌ One or more service connection tests failed.';

  logger.log(finalMessage);

  // Optional: For easy viewing, you can log the full report as a JSON string
  // logger.log(JSON.stringify(results, null, 2));

  return results;
}