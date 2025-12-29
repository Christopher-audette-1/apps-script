// The onOpen function runs automatically when the Google Doc is opened.
function onOpen() {
  DocumentApp.getUi()
      .createMenu('Send to Gamma')
      .addItem('Create Presentation', 'showGammaDialog')
      .addSeparator()
      .addItem('Set API Key', 'showApiKeyDialog')
      .addToUi();
}

function showApiKeyDialog() {
  var html = HtmlService.createHtmlOutputFromFile('ApiKeyDialog')
      .setWidth(300)
      .setHeight(100);
  DocumentApp.getUi().showModalDialog(html, 'Enter Gamma API Key');
}

function saveApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GAMMA_API_KEY', apiKey);
}

function showGammaDialog() {
  var html = HtmlService.createHtmlOutputFromFile('GammaDialog')
      .setWidth(400)
      .setHeight(250);
  DocumentApp.getUi().showModalDialog(html, 'Enter Gamma Template');
}

function processForm(gammaTemplateId, instructions) {
  Logger.log('Gamma Template ID: ' + gammaTemplateId);
  var docContent = getDocContent();
  Logger.log('Document Content: ' + docContent);

  var apiKey = PropertiesService.getScriptProperties().getProperty('GAMMA_API_KEY');
  if (!apiKey) {
    DocumentApp.getUi().alert('Please set your Gamma API key first.');
    return;
  }

  var gammaUrl = callGammaApi(apiKey, docContent, gammaTemplateId, instructions);

  if (gammaUrl) {
    insertGammaUrl(gammaUrl);
    Logger.log('Gamma URL: ' + gammaUrl);
  } else {
    DocumentApp.getUi().alert('Failed to create Gamma presentation.');
  }
}

function getDocContent() {
  var body = DocumentApp.getActiveDocument().getBody();
  var numElements = body.getNumChildren();
  var output = [];

  for (var i = 0; i < numElements; i++) {
    var element = body.getChild(i);
    var type = element.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var paragraph = element.asParagraph();
      var heading = paragraph.getHeading();
      var text = paragraph.getText();

      if (text.trim() === '') continue;

      if (heading === DocumentApp.ParagraphHeading.TITLE) {
        output.push('# ' + text);
      } else if (heading === DocumentApp.ParagraphHeading.HEADING2) {
        output.push('## ' + text);
      } else {
        output.push(text);
      }
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      output.push('---');
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var listItem = element.asListItem();
      var prefix = '';
      // Nesting level is not perfectly translated, but this is a start
      for (var j = 0; j < listItem.getNestingLevel(); j++) {
        prefix += '  ';
      }
      output.push(prefix + '* ' + listItem.getText());
    }
  }

  return output.join('\n');
}

function callGammaApi(apiKey, content, templateId, instructions) {
  var url = 'https://public-api.gamma.app/v1.0/generations';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-API-KEY': apiKey
    },
    payload: JSON.stringify({
      inputText: content,
      textMode: 'preserve',
      format: 'presentation',
      themeId: templateId,
      additionalInstructions: instructions
    })
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var jsonResponse = JSON.parse(response.getContentText());

    if (jsonResponse && jsonResponse.gamma && jsonResponse.gamma.shareUrl) {
      return jsonResponse.gamma.shareUrl;
    } else {
      Logger.log('Invalid response from Gamma API: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Error calling Gamma API: ' + e.toString());
    return null;
  }
}

function insertGammaUrl(url) {
  var body = DocumentApp.getActiveDocument().getBody();
  body.insertParagraph(0, 'Gamma Presentation URL: ' + url);
}
