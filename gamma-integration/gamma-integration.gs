// Jules Session URL: https://app.jules.ai/s/2289490727387524931
// The onOpen function runs automatically when the Google Doc is opened.
function onOpen() {
  DocumentApp.getUi()
      .createMenu('Send to Gamma')
      .addItem('Create Presentation', 'showGammaDialog')
      .addSeparator()
      .addItem('Set API Key', 'showApiKeyDialog')
      .addItem('Add/Manage Templates', 'showAddTemplateDialog')
      .addItem('Add/Manage Themes', 'showAddThemeDialog')
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
        var downloadUrl = (jsonResponse.exports && jsonResponse.exports.pdf) ? jsonResponse.exports.pdf : null;
        updateOrInsertLinks(headingElement, jsonResponse.gammaUrl, downloadUrl);
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

function showAddThemeDialog() {
  var html = HtmlService.createHtmlOutputFromFile('AddThemeDialog')
      .setWidth(400)
      .setHeight(400);
  DocumentApp.getUi().showModalDialog(html, 'Manage Gamma Themes');
}

// Gets the list of saved themes
function getThemes() {
  var properties = PropertiesService.getScriptProperties();
  var themesJson = properties.getProperty('GAMMA_THEMES');
  return themesJson ? JSON.parse(themesJson) : [];
}

// Saves a new theme to the list
function saveTheme(name, id) {
  var themes = getThemes();
  var existingIndex = themes.findIndex(t => t.id === id);
  if (existingIndex > -1) {
    themes[existingIndex].name = name;
  } else {
    themes.push({ name: name, id: id });
  }
  PropertiesService.getScriptProperties().setProperty('GAMMA_THEMES', JSON.stringify(themes));
}

// Removes a theme from the list by its ID
function removeTheme(id) {
  var themes = getThemes();
  var updatedThemes = themes.filter(function(theme) {
    return theme.id !== id;
  });
  PropertiesService.getScriptProperties().setProperty('GAMMA_THEMES', JSON.stringify(updatedThemes));
}

function showGammaDialog() {
  var template = HtmlService.createTemplateFromFile('GammaDialog');
  template.themes = getThemes();
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

  var prompt = section.content;

  if (footerSettings.generationPrompt) {
    prompt += '\n\n[CONSTRAINTS]\n' + footerSettings.generationPrompt;
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('GAMMA_API_KEY');
  if (!apiKey) {
    DocumentApp.getUi().alert('Please set your Gamma API key first.');
    return;
  }

  if (!finalSettings.templateId) {
    DocumentApp.getUi().alert('Please select a template.');
    return;
  }

  var generationId = callGammaApi(apiKey, finalSettings.templateId, prompt, finalSettings);

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

  if (!cursor) { return null; }

  var cursorElement = cursor.getElement();

  // Find the top-level element in the body
  while (cursorElement.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
    cursorElement = cursorElement.getParent();
  }

  // Find the start of the section (the preceding H1)
  var headingElement = null;
  var currentElement = cursorElement;
  while(currentElement != null) {
    if (currentElement.getType() === DocumentApp.ElementType.PARAGRAPH) {
      if (currentElement.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
        headingElement = currentElement;
        break;
      }
    }
    currentElement = currentElement.getPreviousSibling();
  }

  if (headingElement == null) {
    // If no H1 is found before the cursor, check if the cursor is in an H1
    if (cursorElement.getType() === DocumentApp.ElementType.PARAGRAPH && cursorElement.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      headingElement = cursorElement;
    } else {
      return null; // No section found
    }
  }

  // Gather all elements in the section
  var sectionElements = [headingElement];
  currentElement = headingElement.getNextSibling();
  while(currentElement != null) {
    if (currentElement.getType() === DocumentApp.ElementType.PARAGRAPH) {
       if (currentElement.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
        break; // Reached the next section
      }
    }
    sectionElements.push(currentElement);
    currentElement = currentElement.getNextSibling();
  }

  var output = [];
  var inList = false;

  for (var i = 0; i < sectionElements.length; i++) {
    var element = sectionElements[i];
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
          output.push('\n---\n'); // Explicit slide break
          output.push('## ' + text);
          break;
        case DocumentApp.ParagraphHeading.HEADING3:
        case DocumentApp.ParagraphHeading.SUBTITLE:
          output.push('### ' + text);
          break;
        case DocumentApp.ParagraphHeading.HEADING4:
          // This is now handled by the footnote logic below
          break;
        case DocumentApp.ParagraphHeading.NORMAL:
        default:
          output.push(text);
          break;
      }
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      if (!inList) { output.push(''); inList = true; }
      var listItem = element.asListItem();
      var prefix = ' '.repeat(listItem.getNestingLevel() * 2) + '* ';
      output.push(prefix + listItem.getText());
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      inList = false;
      output.push('\n---\n');
    }
  }

  var content = output.join('\n');
  var slides = content.split('\n---\n');
  var processedSlides = [];

  for (var j = 0; j < slides.length; j++) {
    var slideContent = slides[j];
    var footnotes = [];
    var footnoteRefRegex = /\[\^(\d+)\](?!:)/g;
    var footnoteDefRegex = /\[\^(\d+)\]:\s*(.*)/g;
    var refs = slideContent.match(footnoteRefRegex) || [];

    if (refs.length > 0) {
      var defs = content.match(footnoteDefRegex) || [];
      for (var k = 0; k < refs.length; k++) {
        var refNum = refs[k].match(/\d+/)[0];
        for (var l = 0; l < defs.length; l++) {
          if (defs[l].startsWith('[^' + refNum + ']:')) {
            footnotes.push(defs[l]);
          }
        }
      }
    }

    slideContent = slideContent.replace(footnoteDefRegex, '');
    if (footnotes.length > 0) {
      slideContent += '\n\n' + footnotes.join('\n');
    }
    processedSlides.push(slideContent);
  }

  return {
    content: processedSlides.join('\n---\n'),
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
    DocumentApp.getUi().alert('Please select a Gamma Template first.');
    return null;
  }

  // Base payload
  var payload = {
    gammaId: templateId,
    prompt: content,
    folderIds: ["945cxva32oyvqzr"]
  };

  // Add optional themeId if provided
  if (settings.themeId) {
    payload.themeId = settings.themeId;
  }

  // Add optional parameters
  if (settings.exportAs) payload.exportAs = settings.exportAs;
  if (settings.imageStyle) payload.imageOptions = { style: settings.imageStyle };

  payload.sharingOptions = {};
  if (settings.workspaceAccess) payload.sharingOptions.workspaceAccess = settings.workspaceAccess;
  if (settings.externalAccess) payload.sharingOptions.externalAccess = settings.externalAccess;

  if (settings.shareWith) {
    var emails = settings.shareWith.split(',').map(function(email) { return email.trim(); });
    if (emails.length > 0) {
      payload.sharingOptions.emailOptions = {
        recipients: emails,
        access: 'edit'
      };
    }
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
  var doc = DocumentApp.getActiveDocument();

  // 1. Clean up old links from the Heading 1 text
  if (headingElement && headingElement.getType() === DocumentApp.ElementType.PARAGRAPH) {
    var headingPara = headingElement.asParagraph();
    var headingText = headingPara.getText();
    var linkMarker = ' - View';
    var markerIndex = headingText.indexOf(linkMarker);
    if (markerIndex !== -1) {
      headingPara.editAsText().deleteText(markerIndex, headingText.length - 1);
    }
  }

  // 2. Update the document header with the new links
  var header = doc.getHeader();
  if (!header) {
    header = doc.addHeader();
  }

  // Clear existing header content
  header.clear();

  var paragraph = header.appendParagraph('');
  var viewText = paragraph.appendText('View Presentation');
  viewText.setLinkUrl(viewUrl);

  if (downloadUrl) {
    paragraph.appendText(' | ');
    var downloadText = paragraph.appendText('Download');
    downloadText.setLinkUrl(downloadUrl);
  }
}
