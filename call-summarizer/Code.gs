// Main script file for the Call Summarizer

var SOURCE_FOLDER_ID = '13VAjx0gWOLltuKWeLCy0Rh7hk7xG7uyx';
var ROOT_FOLDER_ID_PROP = 'ROOT_FOLDER_ID';
var LAST_RUN_PROP = 'LAST_RUN';

/**
 * Sets the root folder ID for call summaries.
 * To be run once by the user from the script editor to configure the script.
 * Example Folder ID: 1CuVU1asPUFOIScxDs0_Hp5bteT8r8_zr
 */
function setRootFolderId() {
  var ui = DocumentApp.getUi(); // Or SpreadsheetApp.getUi() if attached to a sheet
  var response = ui.prompt('Setup', 'Please enter the Google Drive Folder ID for the "Call Summaries" folder:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    var folderId = response.getResponseText();
    PropertiesService.getScriptProperties().setProperty(ROOT_FOLDER_ID_PROP, folderId);
    ui.alert('Success', 'The Root Folder ID has been set to: ' + folderId, ui.ButtonSet.OK);
  }
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
    throw new Error('Missing required script property: ' + name + '. Please run the setRootFolderId() function to configure the script.');
  }
  return value;
}

/**
 * Main function to process new call files. This is the function that should be triggered daily.
 */
function processNewCallFiles() {
  var lastRun = PropertiesService.getScriptProperties().getProperty(LAST_RUN_PROP);
  lastRun = lastRun ? new Date(lastRun) : null;

  var sourceFolder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
  var files = sourceFolder.getFilesByType(MimeType.PLAIN_TEXT);

  var processedFiles = 0;
  while (files.hasNext()) {
    var file = files.next();
    // Process files created after the last run, or all files if it's the first run.
    if (!lastRun || file.getDateCreated() > lastRun) {
      try {
        createSummaryDocument_(file);
        processedFiles++;
      } catch (e) {
        Logger.log('Error processing file: ' + file.getName() + ' - ' + e.toString() + '\n' + e.stack);
      }
    }
  }

  if (processedFiles > 0) {
    Logger.log('Successfully processed ' + processedFiles + ' new call file(s).');
  } else {
    Logger.log('No new call files to process since the last run.');
  }

  // Update the last run timestamp to now.
  PropertiesService.getScriptProperties().setProperty(LAST_RUN_PROP, new Date().toISOString());
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
 * Creates a summary document from a JSON file.
 * @param {GoogleAppsScript.Drive.File} file The JSON file to process.
 * @private
 */
function createSummaryDocument_(file) {
  var rootFolderId = getRequiredProperty_(ROOT_FOLDER_ID_PROP);
  var rootFolder = DriveApp.getFolderById(rootFolderId);

  var content = file.getBlob().getDataAsString();
  var data = JSON.parse(content);

  if (!data.call || !data.call.summary) {
    Logger.log('Skipping file with missing or invalid data structure: ' + file.getName());
    return;
  }

  var customerName = data.call.account_name || 'Unknown Customer';
  var customerFolder = getOrCreateCustomerFolder_(rootFolder, customerName);

  var title = data.call.title || 'Call Summary';
  var date = new Date(data.call.time).toLocaleDateString();
  var docTitle = title + ' - ' + date;

  var doc = DocumentApp.create(docTitle);
  var body = doc.getBody();

  // --- Append Summaries ---
  body.appendParagraph('Key Discussion Topics').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  (data.call.summary.topics_discussed || []).forEach(function(topic) {
    body.appendListItem(topic.summary || 'No summary provided').setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('Key Takeaways').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var takeaways = (data.call.summary.key_takeaways || '').split('\n').filter(Boolean); // Filter out empty lines
  takeaways.forEach(function(item) {
    // The takeaways are formatted like "- Text", so we remove the first 2 characters.
    body.appendListItem(item.substring(2)).setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('Key Action Items').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  (data.call.summary.key_action_items || []).forEach(function(item) {
    body.appendListItem(item.action_item || 'No action item provided').setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendPageBreak();

  // --- Append Transcript ---
  body.appendParagraph('Transcript').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var transcript = buildTranscript_(data.call.transcript, data.call.users, data.call.externalParticipants);
  body.appendParagraph(transcript);

  doc.saveAndClose();
  var tempFile = DriveApp.getFileById(doc.getId());
  tempFile.moveTo(customerFolder); // Move the new document to the customer's folder
  Logger.log('Created summary document: "' + docTitle + '" in folder "' + customerFolder.getName() + '"');
}

/**
 * Creates a time-driven trigger to run the script daily.
 */
function createDailyTrigger() {
  // First, delete any existing triggers to avoid duplicates.
  deleteTriggers_();

  // Create a new trigger to run 'processNewCallFiles' every day at approximately 1 AM.
  ScriptApp.newTrigger('processNewCallFiles')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
  Logger.log('Daily trigger created successfully for processNewCallFiles.');
}

/**
 * Deletes all existing triggers for this script. A helper function for trigger management.
 * @private
 */
function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  if (triggers.length > 0) {
    Logger.log(triggers.length + ' existing trigger(s) deleted.');
  }
}
