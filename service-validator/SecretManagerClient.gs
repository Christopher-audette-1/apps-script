/**
 * @file SecretManagerClient.gs
 * @description Client for securely fetching secrets from Google Secret Manager.
 */

// Your GCP Project Number (from .gemini/GEMINI.md)
const GCP_PROJECT_NUMBER = '171559253130';

/**
 * Fetches a secret from Google Secret Manager.
 *
 * @param {string} secretName The name of the secret in Secret Manager (e.g., 'HUBSPOT_API_KEY').
 * @param {string} [version='latest'] The version of the secret to fetch. Defaults to 'latest'.
 * @returns {string|null} The secret payload as a string, or null if not found/error.
 */
function getSecret(secretName, version = 'latest') {
  const logger = BetterLog.getCloudLogger();

  if (!GCP_PROJECT_NUMBER) {
    logger.error('GCP_PROJECT_NUMBER is not set in SecretManagerClient.gs.');
    return null;
  }

  const secretPath = `projects/${GCP_PROJECT_NUMBER}/secrets/${secretName}/versions/${version}`;
  const url = `https://secretmanager.googleapis.com/v1/${secretPath}:access`;

  try {
    const service = getOAuthService(); // Get the OAuth2 service for the current script
    const token = service.getAccessToken(); // Get the access token

    if (!token) {
      logger.error('Could not get OAuth2 access token for Secret Manager API.');
      return null;
    }

    const options = {
      'method': 'get',
      'headers': {
        'Authorization': `Bearer ${token}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const payload = JSON.parse(responseText).payload.data;
      // Secret Manager returns the secret data base64 encoded
      return Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    } else {
      logger.error(`Failed to fetch secret '${secretName}'. Status: ${responseCode}. Response: ${responseText}`);
      return null;
    }

  } catch (e) {
    logger.error(`Error fetching secret '${secretName}': ${e.message}`);
    return null;
  }
}

/**
 * Gets an OAuth2 service for the current script.
 * This function relies on the script being linked to a GCP project
 * and having the 'cloud-platform' scope enabled in appsscript.json.
 *
 * @returns {GoogleAppsScript.OAuth2.Service} The OAuth2 service.
 */
function getOAuthService() {
  return OAuth2.createService('SecretManager')
    .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
    .setTokenUrl('https://accounts.google.com/o/oauth2/token')
    .setClientId('YOUR_CLIENT_ID_HERE') // Not needed for Apps Script default service account
    .setClientSecret('YOUR_CLIENT_SECRET_HERE') // Not needed for Apps Script default service account
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/cloud-platform');
}