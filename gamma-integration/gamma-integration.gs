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

function getElementPath(element) {
  var path = [];
  var current = element;
  while (current.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
    var parent = current.getParent();
    var index = parent.getChildIndex(current);
    path.unshift(index);
    current = parent;
  }
  var body = DocumentApp.getActiveDocument().getBody();
  path.unshift(body.getChildIndex(current));
  return path.join('/');
}

function findElementByPath(path) {
  var body = DocumentApp.getActiveDocument().getBody();
  var pathParts = path.split('/');
  var element = body;
  for (var i = 0; i < pathParts.length; i++) {
    var index = parseInt(pathParts[i], 10);
    if (element && typeof element.getChild === 'function' && index < element.getNumChildren()) {
      element = element.getChild(index);
    } else {
      return null; // Path is invalid
    }
  }
  return element;
}

function checkGammaStatus(e) {
  var triggerUid = e.triggerUid;
  var userProperties = PropertiesService.getUserProperties();
  var jobData = JSON.parse(userProperties.getProperty('gammaJob_' + triggerUid));

  if (!jobData) {
    Logger.log('No job data found for trigger: ' + triggerUid + '. Cleaning up.');
    deleteTrigger(triggerUid);
    return;
  }

  jobData.attempts++;
  if (jobData.attempts > 12) { // 12 attempts * 5 minutes = 1 hour
    Logger.log('Job timed out for trigger: ' + triggerUid + '. Cleaning up.');
    userProperties.deleteProperty('gammaJob_' + triggerUid);
    deleteTrigger(triggerUid);
    return;
  }

  userProperties.setProperty('gammaJob_' + triggerUid, JSON.stringify(jobData));

  var apiKey = PropertiesService.getScriptProperties().getProperty('GAMMA_API_KEY');
  var statusUrl = 'https://public-api.gamma.app/v1.0/generations/' + jobData.generationId;
  var options = {
    method: 'get',
    headers: {
      'X-API-KEY': apiKey,
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  try {
    Logger.log('Fetching status for ' + jobData.generationId + ' with trigger ' + triggerUid);
    var response = UrlFetchApp.fetch(statusUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    Logger.log('Poll response code: ' + responseCode + '; body: ' + responseBody);

    if (responseCode !== 200) {
      throw new Error('Received non-200 response: ' + responseBody);
    }

    var jsonResponse = JSON.parse(responseBody);

    if (jsonResponse.status === 'completed' && jsonResponse.gammaUrl) {
      var headingElement = findElementByPath(jobData.headingPath);
      if (headingElement) {
        updateOrInsertLinks(headingElement, jsonResponse.gammaUrl, jsonResponse.exportUrl || null);
        Logger.log('Successfully inserted links for generation ID: ' + jobData.generationId);
      } else {
        Logger.log('Could not find heading element to insert links for generation ID: ' + jobData.generationId);
      }
      userProperties.deleteProperty('gammaJob_' + triggerUid);
      deleteTrigger(triggerUid);
    } else if (jsonResponse.status === 'failed') {
      Logger.log('Generation failed for trigger ' + triggerUid + ': ' + jsonResponse.error);
      userProperties.deleteProperty('gammaJob_' + triggerUid);
      deleteTrigger(triggerUid);
    } else {
      Logger.log('Generation still pending for trigger: ' + triggerUid);
    }
  } catch (err) {
    Logger.log('Error checking Gamma status for trigger ' + triggerUid + ': ' + err.toString());
  }
}

function deleteTrigger(triggerUid) {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getUniqueId() === triggerUid) {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted trigger: ' + triggerUid);
    }
  });
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
  var finalSettings = dialogSettings;
  finalSettings.generationPrompt = footerSettings.generationPrompt || '';

  var apiKey = PropertiesService.getScriptProperties().getProperty('GAMMA_API_KEY');
  if (!apiKey) {
    DocumentApp.getUi().alert('Please set your Gamma API key first.');
    return;
  }

  if (!finalSettings.templateId) {
    DocumentApp.getUi().alert('Please select a template.');
    return;
  }

  var generationId = callGammaApi(apiKey, finalSettings.templateId, section.content, finalSettings);

  if (generationId) {
    var headingPath = getElementPath(section.headingElement);

    var trigger = ScriptApp.newTrigger('checkGammaStatus')
        .timeBased()
        .everyMinutes(5)
        .create();

    var triggerUid = trigger.getUniqueId();

    var jobData = {
      generationId: generationId,
      headingPath: headingPath,
      triggerUid: triggerUid,
      attempts: 0
    };

    PropertiesService.getUserProperties().setProperty('gammaJob_' + triggerUid, JSON.stringify(jobData));

    DocumentApp.getUi().alert('Presentation started! The final link will be added below the section title in a few minutes.');
  } else {
    DocumentApp.getUi().alert('Failed to start Gamma presentation generation.');
  }
}

function getCurrentSectionContent() {
  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();

  if (!cursor) {
    return null;
  }

  var cursorElement = cursor.getElement();
  while (cursorElement.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
    cursorElement = cursorElement.getParent();
  }

  // Sibling traversal to build the element list
  var allElements = [];
  var firstElement = cursorElement;
  while (firstElement.getPreviousSibling() != null) {
    firstElement = firstElement.getPreviousSibling();
  }
  var currentElement = firstElement;
  while (currentElement != null) {
    allElements.push(currentElement);
    currentElement = currentElement.getNextSibling();
  }

  // Find the index of the cursor element
  var cursorIndex = -1;
  for(var i = 0; i < allElements.length; i++) {
    if (allElements[i].isAtDocumentEnd() === cursorElement.isAtDocumentEnd() &&
        allElements[i].getAttributes() === cursorElement.getAttributes() &&
        allElements[i].getText() === cursorElement.getText()) {
      cursorIndex = i;
      break;
    }
  }

  if (cursorIndex === -1) {
    // This is a fallback, but the above should work.
    try {
      var body = doc.getBody();
      cursorIndex = body.getChildIndex(cursorElement);
    } catch(e) {
      DocumentApp.getUi().alert('Critical Error: Could not determine cursor position.');
      return null;
    }
  }


  var sectionStartIndex = -1;
  var headingElement = null;
  for (var i = cursorIndex; i >= 0; i--) {
    var el = allElements[i];
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      sectionStartIndex = i;
      headingElement = el;
      break;
    }
  }

  if (sectionStartIndex === -1) {
    return null;
  }

  var sectionEndIndex = -1;
  for (var i = sectionStartIndex + 1; i < allElements.length; i++) {
    var el = allElements[i];
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      sectionEndIndex = i;
      break;
    }
  }
  if (sectionEndIndex === -1) {
    sectionEndIndex = allElements.length;
  }

  var output = [];
  var inList = false;
  for (var i = sectionStartIndex; i < sectionEndIndex; i++) {
    var element = allElements[i];
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
      return jsonResponse.generationId;
    } else {
      Logger.log('Failed to initiate generation: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Error calling Gamma API: ' + e.toString());
    return null;
  }
}

function updateOrInsertLinks(headingElement, viewUrl, downloadUrl) {
  var body = DocumentApp.getActiveDocument().getBody();
  var headingIndex = body.getChildIndex(headingElement);
  var linkParaIndex = headingIndex + 1;

  // 1. Remove the old separate link paragraph if it exists
  if (linkParaIndex < body.getNumChildren()) {
    var nextElement = body.getChild(linkParaIndex);
    var linkIdentifier = 'Gamma Links:';
    if (nextElement && nextElement.getType() === DocumentApp.ElementType.PARAGRAPH && nextElement.asText().getText().startsWith(linkIdentifier)) {
      body.removeChild(nextElement);
    }
  }

  // 2. Work with the heading paragraph
  if (headingElement.getType() !== DocumentApp.ElementType.PARAGRAPH) {
    Logger.log('The provided heading element is not a Paragraph.');
    return;
  }
  var headingPara = headingElement.asParagraph();
  var headingText = headingPara.getText();

  // 3. Remove any previously added links to make the operation idempotent
  var linkMarker = ' - View';
  var markerIndex = headingText.indexOf(linkMarker);
  if (markerIndex !== -1) {
    // This removes the text from the marker onwards.
    headingPara.editAsText().deleteText(markerIndex, headingText.length - 1);
  }

  // 4. Add the new hyperlinks
  headingPara.appendText(' - ');
  var viewText = headingPara.appendText('View');
  viewText.setLinkUrl(viewUrl);

  if (downloadUrl) {
    headingPara.appendText(' | ');
    var downloadText = headingPara.appendText('Download');
    downloadText.setLinkUrl(downloadUrl);
  }
}
