// The onOpen function runs automatically when the Google Doc is opened.
function onOpen() {
  DocumentApp.getUi()
      .createMenu('Send to Gamma')
      .addItem('Create Presentation', 'showGammaDialog')
      .addSeparator()
      .addItem('Set API Key', 'showApiKeyDialog')
      .addItem('Add/Manage Templates', 'showAddTemplateDialog')
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

function showAddTemplateDialog() {
  var html = HtmlService.createHtmlOutputFromFile('AddTemplateDialog')
      .setWidth(400)
      .setHeight(400);
  DocumentApp.getUi().showModalDialog(html, 'Manage Gamma Templates');
}

// Gets the list of saved templates
function getTemplates() {
  var properties = PropertiesService.getScriptProperties();
  var templatesJson = properties.getProperty('GAMMA_TEMPLATES');
  return templatesJson ? JSON.parse(templatesJson) : [];
}

// Saves a new template to the list
function saveTemplate(name, id) {
  var templates = getTemplates();
  // Check if a template with the same name or id already exists and update it
  var existingIndex = templates.findIndex(t => t.id === id);
  if (existingIndex > -1) {
    templates[existingIndex].name = name;
  } else {
    templates.push({ name: name, id: id });
  }
  PropertiesService.getScriptProperties().setProperty('GAMMA_TEMPLATES', JSON.stringify(templates));
}

// Removes a template from the list by its ID
function removeTemplate(id) {
  var templates = getTemplates();
  var updatedTemplates = templates.filter(function(template) {
    return template.id !== id;
  });
  PropertiesService.getScriptProperties().setProperty('GAMMA_TEMPLATES', JSON.stringify(updatedTemplates));
}

function showGammaDialog() {
  var template = HtmlService.createTemplateFromFile('GammaDialog');
  template.templates = getTemplates();
  var html = template.evaluate()
      .setWidth(450)
      .setHeight(400); // Adjusted height for simplified dialog
  DocumentApp.getUi().showModalDialog(html, 'Create Gamma Presentation');
}

function processForm(dialogSettings) {
  var section = getCurrentSectionContent();
  if (!section) {
    DocumentApp.getUi().alert('Could not determine the current section. Please place your cursor within a section defined by a "Heading 1".');
    return;
  }

  var footerSettings = getSettingsFromFooter();

  // Combine settings: Start with dialog settings, then add footer prompt
  var finalSettings = dialogSettings;
  finalSettings.generationPrompt = footerSettings.generationPrompt || '';

  Logger.log('Section Content: ' + section.content);
  Logger.log('Final Combined Settings: ' + JSON.stringify(finalSettings));

  var apiKey = PropertiesService.getScriptProperties().getProperty('GAMMA_API_KEY');
  if (!apiKey) {
    DocumentApp.getUi().alert('Please set your Gamma API key first.');
    return;
  }

  if (!finalSettings.templateId) {
    DocumentApp.getUi().alert('Please select a template.');
    return;
  }

  var gammaResponse = callGammaApi(apiKey, finalSettings.templateId, section.content, finalSettings);

  if (gammaResponse && gammaResponse.gammaUrl) {
    updateOrInsertLinks(section.headingElement, gammaResponse.gammaUrl, gammaResponse.downloadUrl);
    Logger.log('Gamma URL: ' + gammaResponse.gammaUrl);
  } else {
    DocumentApp.getUi().alert('Failed to create Gamma presentation.');
  }
}

function getCurrentSectionContent() {
  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();
  if (!cursor) {
    // No cursor, likely no focused element
    return null;
  }

  var body = doc.getBody();
  var elements = body.getChildren();
  var cursorElement = cursor.getElement();
  var cursorIndex = elements.indexOf(cursorElement);

  var sectionStartIndex = -1;
  var sectionEndIndex = -1;
  var headingElement = null;

  // Find the "Heading 1" that marks the beginning of the current section
  for (var i = cursorIndex; i >= 0; i--) {
    var el = elements[i];
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      sectionStartIndex = i;
      headingElement = el;
      break;
    }
  }

  if (sectionStartIndex === -1) {
    return null; // Not in a section
  }

  // Find the end of the section (the next "Heading 1" or the end of the document)
  for (var i = sectionStartIndex + 1; i < elements.length; i++) {
    var el = elements[i];
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      sectionEndIndex = i;
      break;
    }
  }
  if (sectionEndIndex === -1) {
    sectionEndIndex = elements.length;
  }

  // Now, parse only the content within this section
  var output = [];
  var inList = false;
  for (var i = sectionStartIndex; i < sectionEndIndex; i++) {
    var element = elements[i];
    var type = element.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      inList = false;
      var paragraph = element.asParagraph();
      var heading = paragraph.getHeading();
      var text = paragraph.getText();

      if (text.trim() === '') continue;

      switch (heading) {
        case DocumentApp.ParagraphHeading.HEADING1:
          output.push('# ' + text);
          break;
        case DocumentApp.ParagraphHeading.HEADING2:
          output.push('\n## ' + text);
          break;
        case DocumentApp.ParagraphHeading.SUBTITLE:
          output.push('### ' + text);
          break;
        case DocumentApp.ParagraphHeading.HEADING4:
          output.push('\n**Footer:** ' + text);
          break;
        case DocumentApp.ParagraphHeading.NORMAL:
        default:
          output.push(text);
          break;
      }
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      inList = false;
      output.push('\n---\n');
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      if (!inList) { output.push(''); inList = true; }
      var listItem = element.asListItem();
      var prefix = ' '.repeat(listItem.getNestingLevel() * 2);
      output.push(prefix + '* ' + listItem.getText());
    }
  }

  return {
    content: output.join('\n'),
    headingElement: headingElement
  };
}

function getSettingsFromFooter() {
  var footer = DocumentApp.getActiveDocument().getFooter();
  if (footer) {
    var text = footer.getText();
    var lines = text.split('\n');
    var filteredLines = lines.filter(function(line) {
      return line.trim() !== 'AI Instructions';
    });
    return {
      generationPrompt: filteredLines.join('\n')
    };
  }
  return { generationPrompt: '' };
}

function callGammaApi(apiKey, templateId, content, settings) {
  var generationUrl = 'https://public-api.gamma.app/v1.0/generations/from-template';

  if (!templateId) {
    DocumentApp.getUi().alert('Please set your Gamma Template ID first.');
    return null;
  }

  // Base payload
  var payload = {
    gammaId: templateId,
    prompt: content
  };

  // Add optional parameters
  if (settings.generationPrompt) payload.additionalInstructions = settings.generationPrompt;
  if (settings.exportAs) payload.exportAs = settings.exportAs;
  if (settings.imageStyle) payload.imageOptions = { style: settings.imageStyle };
  if (settings.workspaceAccess || settings.externalAccess) {
    payload.sharingOptions = {};
    if (settings.workspaceAccess) payload.sharingOptions.workspaceAccess = settings.workspaceAccess;
    if (settings.externalAccess) payload.sharingOptions.externalAccess = settings.externalAccess;
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-API-KEY': apiKey },
    payload: JSON.stringify(payload)
  };

  try {
    var response = UrlFetchApp.fetch(generationUrl, options);
    var jsonResponse = JSON.parse(response.getContentText());

    if (jsonResponse.generationId) {
      // Poll for completion
      return pollForPresentation(apiKey, jsonResponse.generationId);
    } else {
      Logger.log('Failed to initiate generation: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Error calling Gamma API: ' + e.toString());
    return null;
  }
}

function pollForPresentation(apiKey, generationId) {
  var statusUrl = 'https://public-api.gamma.app/v1.0/generations/' + generationId;
  var options = {
    method: 'get',
    headers: { 'X-API-KEY': apiKey }
  };

  for (var i = 0; i < 10; i++) { // Poll for a reasonable time
    Utilities.sleep(3000); // Wait for 3 seconds
    var response = UrlFetchApp.fetch(statusUrl, options);
    var jsonResponse = JSON.parse(response.getContentText());

    if (jsonResponse.status === 'completed') {
      return {
        gammaUrl: jsonResponse.gamma.shareUrl,
        downloadUrl: jsonResponse.gamma.exportUrl || null // exportUrl may not always be present
      };
    } else if (jsonResponse.status === 'failed') {
      Logger.log('Generation failed: ' + jsonResponse.error);
      return null;
    }
    // if "pending", continue loop
  }
  Logger.log('Polling timed out for generation ID: ' + generationId);
  return null;
}

function updateOrInsertLinks(headingElement, viewUrl, downloadUrl) {
  var body = DocumentApp.getActiveDocument().getBody();
  var headingIndex = body.getChildIndex(headingElement);
  var linkParaIndex = headingIndex + 1;
  var nextElement = body.getChild(linkParaIndex);

  // Check if the element immediately following the heading is our link paragraph
  var linkIdentifier = 'Gamma Links:';
  if (nextElement && nextElement.getType() === DocumentApp.ElementType.PARAGRAPH && nextElement.asText().getText().startsWith(linkIdentifier)) {
    // It's our link paragraph, so update it
    var linkPara = nextElement.asParagraph();
    linkPara.clear();
    linkPara.appendText(linkIdentifier);
    linkPara.appendText('\n');
    linkPara.appendText('View Presentation: ' + viewUrl);
    if (downloadUrl) {
      linkPara.appendText('\n');
      linkPara.appendText('Download Link: ' + downloadUrl);
    }
  } else {
    // It's not our link paragraph, so insert a new one
    var newPara = body.insertParagraph(linkParaIndex, '');
    newPara.appendText(linkIdentifier);
    newPara.appendText('\n');
    newPara.appendText('View Presentation: ' + viewUrl);
    if (downloadUrl) {
      newPara.appendText('\n');
      newPara.appendText('Download Link: ' + downloadUrl);
    }
  }
}
