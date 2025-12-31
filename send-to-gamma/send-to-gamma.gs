// The onOpen function runs automatically when the Google Doc is opened.
function onOpen() {
  DocumentApp.getUi()
    .createMenu('Send to Gamma')
    .addItem('Send', 'showGammaTemplateDialog')
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

// This function simulates calling the Gamma API.
// You will need to replace this with the actual API call.
function callGammaApi(content, gammaTemplate) {
  // This is a placeholder for the actual Gamma API call.
  // You will need to replace this with the actual API endpoint and authentication.
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      content: content,
      template: gammaTemplate
    }),
    // Add your authentication headers here
  };
  
  try {
    // Replace with the actual Gamma API URL
    var response = UrlFetchApp.fetch('https://api.gamma.app/create', options);
    var jsonResponse = JSON.parse(response.getContentText());
    return jsonResponse.url; // Assuming the API returns a URL in a 'url' field
  } catch (e) {
    Logger.log('Error calling Gamma API: ' + e.toString());
    return null;
  }
}

// This function inserts the URL at the end of the document.
function insertUrlIntoDocument(url) {
  var body = DocumentApp.getActiveDocument().getBody();
  body.appendParagraph('Generated Gamma URL: ' + url);
}
