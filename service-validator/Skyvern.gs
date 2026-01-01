/**
 * @file Skyvern.gs
 * @description Connection test for the Skyvern API.
 */

function testSkyvernConnection() {
  const serviceName = 'Skyvern';
  const apiKey = getSecret('SKYVERN_API_KEY');

  if (!apiKey) {
    return {
      service: serviceName,
      status: 'FAILURE',
      message: `[${serviceName}] API key not found. Please ensure SKYVERN_API_KEY is configured in Google Secret Manager.`,
    };
  }

  const url = 'https://api.skyvern.com/v1/health';
  const options = {
    'method': 'get',
    'headers': {
      'X-API-Key': apiKey
    },
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode >= 200 && responseCode < 300) {
      return {
        service: serviceName,
        status: 'SUCCESS',
        message: `[${serviceName}] ✅ Connection successful. API key is valid.`
      };
    } else if (responseCode === 401 || responseCode === 403) {
      return {
        service: serviceName,
        status: 'FAILURE',
        message: `[${serviceName}] ❌ Connection failed. API key is invalid or has insufficient permissions (${responseCode}).`
      };
    } else {
      return {
        service: serviceName,
        status: 'FAILURE',
        message: `[${serviceName}] ❌ Connection failed with status code: ${responseCode}. Response: ${response.getContentText()}`
      };
    }
  } catch (e) {
    return {
      service: serviceName,
      status: 'FAILURE',
      message: `[${serviceName}] ❌ An unexpected error occurred: ${e.toString()}. Please check the API endpoint URL.`
    };
  }
}