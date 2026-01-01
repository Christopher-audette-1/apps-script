/**
 * @file Gamma.gs
 * @description Connection test for the Gamma API.
 */

function testGammaConnection() {
  const serviceName = 'Gamma';
  const apiKey = getSecret('GAMMA_API_KEY');

  if (!apiKey) {
    return {
      service: serviceName,
      status: 'FAILURE',
      message: `[${serviceName}] API key not found. Please ensure GAMMA_API_KEY is configured in Google Secret Manager.`,
    };
  }

  const url = 'https://api.gamma.app/v1/workspaces';
  const options = {
    'method': 'get',
    'contentType': 'application/json',
    'headers': {
      'Authorization': `Bearer ${apiKey}`
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
    } else if (responseCode === 401) {
      return {
        service: serviceName,
        status: 'FAILURE',
        message: `[${serviceName}] ❌ Connection failed. API key is invalid or has insufficient permissions (401 Unauthorized).`
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
      message: `[${serviceName}] ❌ An unexpected error occurred: ${e.toString()}`
    };
  }
}