// Main script file for the Call Summarizer

// --- Constants ---
var SOURCE_FOLDER_ID = '13VAjx0gWOLltuKWeLCy0Rh7hk7xG7uyx';
var ROOT_FOLDER_ID_PROP = 'ROOT_FOLDER_ID';
var LAST_RUN_PROP = 'LAST_RUN';
var GEMINI_API_KEY_PROP = 'GEMINI_API_KEY';

// --- Configuration Functions (to be run manually by the user) ---

/**
 * Sets the root folder ID for call summaries.
 * To be run once by the user from the script editor.
 */
function setRootFolderId() {
  var ui = DocumentApp.getUi();
  var response = ui.prompt('Setup', 'Please enter the Google Drive Folder ID for the "Call Summaries" folder:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    var folderId = response.getResponseText();
    PropertiesService.getScriptProperties().setProperty(ROOT_FOLDER_ID_PROP, folderId);
    ui.alert('Success', 'The Root Folder ID has been set to: ' + folderId, ui.ButtonSet.OK);
  }
}

/**
 * Sets the Gemini API key.
 * To be run once by the user from the script editor.
 */
function setGeminiApiKey() {
  var ui = DocumentApp.getUi();
  var response = ui.prompt('Setup', 'Please enter your Gemini API Key:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    var apiKey = response.getResponseText();
    PropertiesService.getScriptProperties().setProperty(GEMINI_API_KEY_PROP, apiKey);
    ui.alert('Success', 'Your Gemini API Key has been set.', ui.ButtonSet.OK);
  }
}


// --- Main Processing Logic ---

/**
 * Main function to process new call files. This is the function to trigger daily.
 */
function processNewCallFiles() {
  var lastRun = PropertiesService.getScriptProperties().getProperty(LAST_RUN_PROP);
  lastRun = lastRun ? new Date(lastRun) : null;

  var sourceFolder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
  var files = sourceFolder.getFilesByType(MimeType.PLAIN_TEXT);

  var processedFiles = 0;
  while (files.hasNext()) {
    var file = files.next();
    if (!lastRun || file.getDateCreated() > lastRun) {
      try {
        createSummaryDocument_(file);
        processedFiles++;
      } catch (e) {
        Logger.log('Error processing file: ' + file.getName() + ' - ' + e.toString() + '\n' + e.stack);
      }
    }
  }

  Logger.log(processedFiles > 0 ? 'Successfully processed ' + processedFiles + ' new file(s).' : 'No new files to process.');
  PropertiesService.getScriptProperties().setProperty(LAST_RUN_PROP, new Date().toISOString());
}

/**
 * Creates a summary document by generating content with Gemini and formatting a Google Doc.
 * @param {GoogleAppsScript.Drive.File} file The JSON file to process.
 * @private
 */
function createSummaryDocument_(file) {
  var rootFolder = DriveApp.getFolderById(getRequiredProperty_(ROOT_FOLDER_ID_PROP));
  var content = file.getBlob().getDataAsString();
  var data = JSON.parse(content);

  if (!data.call || !data.call.transcript) {
    Logger.log('Skipping file with missing transcript: ' + file.getName());
    return;
  }

  var customerName = data.call.account_name || 'Unknown Customer';
  var customerFolder = getOrCreateCustomerFolder_(rootFolder, customerName);

  var fullTranscript = buildTranscript_(data.call.transcript, data.call.users, data.call.externalParticipants);
  var generatedSummary = callGeminiApi_(fullTranscript);

  if (!generatedSummary) {
    Logger.log('Failed to generate summary for file: ' + file.getName());
    return;
  }

  var title = data.call.title || 'Call Summary';
  var date = new Date(data.call.time).toLocaleDateString();
  var docTitle = title + ' - ' + date;

  var doc = DocumentApp.create(docTitle);
  var body = doc.getBody();

  body.appendParagraph('Key Discussion Topics').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  parseAndAppendList_(body, generatedSummary.discussion_topics);

  body.appendParagraph('Key Takeaways').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  parseAndAppendList_(body, generatedSummary.key_takeaways);

  body.appendParagraph('Key Action Items').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  parseAndAppendList_(body, generatedSummary.action_items);

  body.appendPageBreak();
  body.appendParagraph('Transcript').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(fullTranscript);

  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(customerFolder);
  Logger.log('Created summary document: "' + docTitle + '" in folder "' + customerFolder.getName() + '"');
}


// --- Helper Functions ---

/**
 * Calls the Gemini API to generate a summary from a transcript.
 * @param {string} transcript The full call transcript.
 * @returns {Object|null} The parsed JSON summary object or null if an error occurs.
 * @private
 */
function callGeminiApi_(transcript) {
  var apiKey = getRequiredProperty_(GEMINI_API_KEY_PROP);
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + apiKey;

  var prompt = "Analyze the following call transcript and provide a summary in JSON format. The JSON object must have three keys: 'discussion_topics', 'key_takeaways', and 'action_items'. Each key should have a value that is an array of strings. Please provide at least 3 items for each category.\n\nTranscript:\n" + transcript;

  var payload = {
    "contents": [{
      "parts": [{ "text": prompt }]
    }]
  };

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();

  if (responseCode === 200) {
    var jsonResponse = JSON.parse(responseBody);
    // Extract the text content which is expected to be a JSON string
    var contentText = jsonResponse.candidates[0].content.parts[0].text;
    // Clean the content text by removing markdown backticks and the word "json"
    var cleanJsonText = contentText.replace(/```json\n/g, '').replace(/```/g, '');
    return JSON.parse(cleanJsonText);
  } else {
    Logger.log('Gemini API Error: ' + responseCode + ' - ' + responseBody);
    return null;
  }
}

/**
 * Parses a string array and appends it as a bulleted list to the document body.
 * @param {GoogleAppsScript.Document.Body} body The document body.
 * @param {Array<string>} items The array of strings to append.
 * @private
 */
function parseAndAppendList_(body, items) {
    if (Array.isArray(items)) {
        items.forEach(function(item) {
            body.appendListItem(item).setGlyphType(DocumentApp.GlyphType.BULLET);
        });
    }
}

/**
 * Builds a formatted transcript string from the call data.
 * @param {Array<Object>} transcriptData The transcript data from the JSON.
 * @param {Array<Object>} users The internal users from the JSON.
 * @param {Array<Object>} externalParticipants The external participants from the JSON.
 * @returns {string} The formatted transcript.
 * @private
 */
function buildTranscript_(transcriptData, users, externalParticipants) {
  var speakerMap = {};
  (users || []).forEach(function(user) {
    var name = user.userEmail ? user.userEmail.split('@')[0] : 'Internal User';
    speakerMap[user.personId] = name;
  });
  (externalParticipants || []).forEach(function(participant) {
    var name = participant.email ? participant.email.split('@')[0] : 'External Participant';
    speakerMap[participant.personId] = name;
  });

  var transcript = '';
  (transcriptData || []).forEach(function(line) {
    var speaker = speakerMap[line.personId] || 'Unknown Speaker';
    transcript += speaker + ': ' + line.text + '\n';
  });
  return transcript;
}

/**
 * Gets or creates a customer folder inside the root folder.
 * @param {GoogleAppsScript.Drive.Folder} rootFolder The root folder for call summaries.
 * @param {string} customerName The name of the customer.
 * @returns {GoogleAppsScript.Drive.Folder} The customer's folder.
 * @private
 */
function getOrCreateCustomerFolder_(rootFolder, customerName) {
  var folders = rootFolder.getFoldersByName(customerName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return rootFolder.createFolder(customerName);
}

/**
 * Gets a required script property.
 * @param {string} name The name of the property.
 * @returns {string} The property value.
 * @private
 */
function getRequiredProperty_(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error('Missing required script property: ' + name + '. Please run the appropriate setup function.');
  }
  return value;
}

/**
 * Creates a time-driven trigger to run the script daily.
 */
function createDailyTrigger() {
  deleteTriggers_();
  ScriptApp.newTrigger('processNewCallFiles')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
  Logger.log('Daily trigger created successfully.');
}

/**
 * Deletes all existing triggers for this script.
 * @private
 */
function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}
