// --- Constants ---
var GAMMA_API_KEY_PROP = 'GAMMA_API_KEY';

// --- Configuration ---

// This function should be run once by the user to securely set their API key.
function DO_THIS_ONCE_setGammaApiKey() {
  var ui = DocumentApp.getUi();
  var response = ui.prompt(
    'Set Gamma API Key',
    'Please enter your Gamma API key (starts with sk-gamma-...):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    var apiKey = response.getResponseText();
    if (apiKey && apiKey.trim() !== '') {
      PropertiesService.getScriptProperties().setProperty(GAMMA_API_KEY_PROP, apiKey);
      ui.alert('SUCCESS: Gamma API Key has been set.');
      Logger.log('SUCCESS: Gamma API Key has been set.');
    } else {
      ui.alert('Operation cancelled. No API key was provided.');
    }
  } else {
    ui.alert('Operation cancelled.');
  }
}

// --- Menu ---

// The onOpen function runs automatically when the Google Doc is opened.
function onOpen() {
  DocumentApp.getUi()
    .createMenu('Gamma Tools')
    .addItem('Send to Gamma', 'showGammaTemplateDialog')
    .addSeparator()
    .addItem('Set Gamma API Key', 'DO_THIS_ONCE_setGammaApiKey')
    .addToUi();
}

// This function displays an HTML dialog to the user.
function showGammaTemplateDialog() {
  var html = HtmlService.createHtmlOutputFromFile('gamma-template-dialog')
    .setWidth(400)
    .setHeight(300);
  DocumentApp.getUi().showModalDialog(html, 'Select Gamma Template');
}

// This function is called from the dialog. It extracts the document content,
// sends it to Gamma, and inserts the returned URL.
function sendToGamma(gammaTemplate) {
  var content = getDocumentContent();
  var gammaUrl = callGammaApi(content, gammaTemplate);
  if (gammaUrl) {
    insertUrlIntoDocument(gammaUrl);
  } else {
    DocumentApp.getUi().alert('Failed to get URL from Gamma.');
  }
}

// This function extracts the content of the current document.
function getDocumentContent() {
  var body = DocumentApp.getActiveDocument().getBody();
  // This is a simplified content extraction. 
  // We'll need to refine this based on the actual document structure.
  return body.getText();
}

// This function makes an authenticated call to a specified Gamma API endpoint.
function callGammaApi(endpoint, method, payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty(GAMMA_API_KEY_PROP);
  if (!apiKey) {
    DocumentApp.getUi().alert('Gamma API key is not set. Please run "Set Gamma API Key" from the menu.');
    return null;
  }

  var options = {
    method: method || 'get',
    contentType: 'application/json',
    headers: {
      'X-API-KEY': apiKey
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  try {
    var response = UrlFetchApp.fetch('https://public-api.gamma.app/v1.0' + endpoint, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('Gamma API Call Successful: ' + responseCode + ' - ' + responseBody);
      return JSON.parse(responseBody);
    } else {
      Logger.log('Error calling Gamma API: ' + responseCode + ' - ' + responseBody);
      DocumentApp.getUi().alert('Gamma API Error: ' + responseBody);
      return null;
    }
  } catch (e) {
    Logger.log('Exception calling Gamma API: ' + e.toString());
    DocumentApp.getUi().alert('An error occurred while contacting the Gamma API.');
    return null;
  }
}

// This function is for testing the connection by fetching user details.
function testGammaConnection() {
  var userData = callGammaApi('/users/me');
  if (userData) {
    DocumentApp.getUi().alert('Successfully connected to Gamma API. User: ' + userData.user.name);
  }
}

// This function inserts the URL at the end of the document.
function insertUrlIntoDocument(url) {
  var body = DocumentApp.getActiveDocument().getBody();
  body.appendParagraph('Generated Gamma URL: ' + url);
}
