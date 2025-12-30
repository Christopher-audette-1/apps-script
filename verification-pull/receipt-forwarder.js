// Main script file for the Call Summarizer

var SOURCE_FOLDER_ID = '13VAjx0gWOLltuKWeLCy0Rh7hk7xG7uyx';
var ROOT_FOLDER_ID_PROP = 'ROOT_FOLDER_ID';
var LAST_RUN_PROP = 'LAST_RUN';

/**
 * Sets the root folder ID for call summaries.
 * Run this function once from the script editor to configure the script.
 * @param {string} rootFolderId The ID of the Google Drive folder to store summaries in.
 */
function setRootFolderId(rootFolderId) {
  PropertiesService.getScriptProperties().setProperty(ROOT_FOLDER_ID_PROP, rootFolderId);
  Logger.log('Root folder ID set to: ' + rootFolderId);
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
    throw new Error('Missing required script property: ' + name);
  }
  return value;
}

/**
 * Main function to process new call files.
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
        Logger.log('Error processing file: ' + file.getName() + ' - ' + e.toString());
      }
    }
  }

  if (processedFiles > 0) {
    Logger.log('Successfully processed ' + processedFiles + ' new call file(s).');
  } else {
    Logger.log('No new call files to process.');
  }

  PropertiesService.getScriptProperties().setProperty(LAST_RUN_PROP, new Date().toISOString());
}

/**
 * Gets or creates a customer folder.
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
    var name = user.userEmail ? user.userEmail.split('@')[0] : 'Unknown User';
    speakerMap[user.personId] = name;
  });
  (externalParticipants || []).forEach(function(participant) {
    var name = participant.email ? participant.email.split('@')[0] : 'External Participant';
    speakerMap[participant.personId] = name;
  });

  var transcript = '';
  (transcriptData || []).forEach(function(line) {
    var speaker = speakerMap[line.personId] || 'Unknown';
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
    Logger.log('Skipping file with missing data: ' + file.getName());
    return;
  }

  var customerName = data.call.account_name || 'Unknown Customer';
  var customerFolder = getOrCreateCustomerFolder_(rootFolder, customerName);

  var title = data.call.title || 'Call Summary';
  var date = new Date(data.call.time).toLocaleDateString();
  var docTitle = title + ' - ' + date;

  var doc = DocumentApp.create(docTitle);
  var body = doc.getBody();

  body.appendParagraph('Key Discussion Topics').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  (data.call.summary.topics_discussed || []).forEach(function(topic) {
    body.appendListItem(topic.summary || 'No summary provided').setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('Key Takeaways').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var takeaways = (data.call.summary.key_takeaways || '').split('\n').filter(Boolean);
  takeaways.forEach(function(item) {
    body.appendListItem(item.substring(2)).setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('Key Action Items').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  (data.call.summary.key_action_items || []).forEach(function(item) {
    body.appendListItem(item.action_item || 'No action item provided').setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendPageBreak();

  body.appendParagraph('Transcript').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var transcript = buildTranscript_(data.call.transcript, data.call.users, data.call.externalParticipants);
  body.appendParagraph(transcript);

  doc.saveAndClose();
  var tempFile = DriveApp.getFileById(doc.getId());
  tempFile.moveTo(customerFolder);
  Logger.log('Created summary document: "' + docTitle + '" in folder "' + customerFolder.getName() + '"');
}

/**
 * Creates a time-driven trigger to run the script daily.
 */
function createDailyTrigger() {
  deleteTriggers_();
  ScriptApp.newTrigger('processNewCallFiles')
    .timeBased()
    .everyDays(1)
    .atHour(1) // Run at 1 AM
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