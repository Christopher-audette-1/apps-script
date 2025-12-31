// Main script file for the Call Summarizer

// --- Constants ---
var SOURCE_FOLDER_ID = '13VAjx0gWOLltuKWeLCy0Rh7hk7xG7uyx';
var ROOT_FOLDER_ID_PROP = 'ROOT_FOLDER_ID';
var GEMINI_API_KEY_PROP = 'GEMINI_API_KEY';

// --- Configuration Functions (to be run manually by the user) ---

function DO_THIS_ONCE_setApiKey() {
  var apiKey = 'AIzaSyBoeIcPZ9TEtywE9xWkIURJSm0XRZ3AvD8';
  PropertiesService.getScriptProperties().setProperty(GEMINI_API_KEY_PROP, apiKey);
  Logger.log('SUCCESS: Gemini API Key has been set.');
}

function DO_THIS_ONCE_setRootFolder() {
  var folderId = '1CuVU1asPUFOIScxDs0_Hp5bteT8r8_zr';
  PropertiesService.getScriptProperties().setProperty(ROOT_FOLDER_ID_PROP, folderId);
  Logger.log('SUCCESS: Root Folder ID has been set to: ' + folderId);
}


// --- Main Processing Logic ---

function processNewCallFiles() {
  var rootFolder = DriveApp.getFolderById(getRequiredProperty_(ROOT_FOLDER_ID_PROP));
  var existingDocsCache = buildExistingDocsCache_(rootFolder);

  var sourceFolder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
  var files = sourceFolder.getFilesByType(MimeType.PLAIN_TEXT);

  var processedFiles = 0;
  var skippedFiles = 0;

  while (files.hasNext()) {
    var file = files.next();
    try {
      var content = file.getBlob().getDataAsString();
      var data = JSON.parse(content);

      if (!data.call || !data.call.title) {
        Logger.log('Skipping file with missing data: ' + file.getName());
        continue;
      }

      var title = data.call.title || 'Call Summary';
      var date = new Date(data.call.time).toLocaleDateString();
      var docTitle = title + ' - ' + date;

      if (existingDocsCache.has(docTitle)) {
        skippedFiles++;
        continue;
      }

      if (createSummaryDocument_(file, data, docTitle)) {
        processedFiles++;
        existingDocsCache.add(docTitle);
      }
    } catch (e) {
      Logger.log('Error processing file: ' + file.getName() + ' - ' + e.toString() + '\n' + e.stack);
    }
  }

  if (skippedFiles > 0) Logger.log('Skipped ' + skippedFiles + ' duplicate file(s).');
  Logger.log(processedFiles > 0 ? 'Successfully created ' + processedFiles + ' new document(s).' : 'No new documents to create.');
}

function createSummaryDocument_(file, data, docTitle) {
  var rootFolder = DriveApp.getFolderById(getRequiredProperty_(ROOT_FOLDER_ID_PROP));

  if (!data.call || !data.call.transcript) {
    Logger.log('Skipping file with missing transcript: ' + file.getName());
    return false;
  }

  var fullTranscript = buildTranscript_(data.call.transcript, data.call.users, data.call.externalParticipants);

  // --- Guard for empty or short transcripts ---
  if (!fullTranscript || fullTranscript.trim().split(' ').length < 10) {
    Logger.log('Skipping file with short or empty transcript: ' + file.getName());
    return false;
  }

  var customerName = data.call.account_name || 'Unknown Customer';
  var customerFolder = getOrCreateCustomerFolder_(rootFolder, customerName);

  var generatedSummary = callGeminiApi_(fullTranscript);

  if (!generatedSummary) {
    Logger.log('Failed to generate summary for file: ' + file.getName());
    return false;
  }

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
  return true;
}


// --- Folder Merging Functions ---

function findAndSuggestFolderMerges() {
  var rootFolder = DriveApp.getFolderById(getRequiredProperty_(ROOT_FOLDER_ID_PROP));
  var folders = rootFolder.getFolders();
  var folderList = [];
  while(folders.hasNext()) folderList.push(folders.next());

  Logger.log('Checking for similar folders... (Threshold > 0.8)');
  var suggestionsFound = false;
  for (var i = 0; i < folderList.length; i++) {
    for (var j = i + 1; j < folderList.length; j++) {
      var folder1 = folderList[i];
      var folder2 = folderList[j];

      var similarity = jaroWinklerSimilarity_(folder1.getName().toLowerCase(), folder2.getName().toLowerCase());

      if (similarity > 0.8) {
        suggestionsFound = true;
        Logger.log('---\nPotential duplicate found:\n  Folder A: "' + folder1.getName() + '"\n  Folder B: "' + folder2.getName() + '"\nTo merge B into A, run:\nmergeFolders("' + folder2.getName() + '", "' + folder1.getName() + '")\n---');
      }
    }
  }

  if (!suggestionsFound) Logger.log('No similar folders found.');
  Logger.log('Folder check complete.');
}

function mergeFolders(sourceFolderName, destinationFolderName) {
  var rootFolder = DriveApp.getFolderById(getRequiredProperty_(ROOT_FOLDER_ID_PROP));
  var sourceFolders = rootFolder.getFoldersByName(sourceFolderName);
  var destFolders = rootFolder.getFoldersByName(destinationFolderName);

  if (!sourceFolders.hasNext()) {
    Logger.log('Error: Could not find source folder "' + sourceFolderName + '".');
    return;
  }
  if (!destFolders.hasNext()) {
    Logger.log('Error: Could not find destination folder "' + destinationFolderName + '".');
    return;
  }

  var sourceFolder = sourceFolders.next();
  var destFolder = destFolders.next();

  if (sourceFolder.getId() === destFolder.getId()) {
    Logger.log('Error: Source and destination are the same.');
    return;
  }

  var files = sourceFolder.getFiles();
  var count = 0;
  while (files.hasNext()) {
    files.next().moveTo(destFolder);
    count++;
  }

  sourceFolder.setTrashed(true);
  Logger.log('SUCCESS: Merged ' + count + ' file(s) from "' + sourceFolderName + '" to "' + destinationFolderName + '". Source folder deleted.');
}


// --- Helper Functions ---

function buildExistingDocsCache_(rootFolder) {
  var cache = new Set();
  var customerFolders = rootFolder.getFolders();
  while (customerFolders.hasNext()) {
    var customerFolder = customerFolders.next();
    var docs = customerFolder.getFilesByType(MimeType.GOOGLE_DOCS);
    while (docs.hasNext()) {
      cache.add(docs.next().getName());
    }
  }
  return cache;
}

function jaroWinklerSimilarity_(s1, s2) {
  var m = 0;
  if (s1.length === 0 || s2.length === 0) return 0;
  var range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  var s1Matches = new Array(s1.length).fill(false);
  var s2Matches = new Array(s2.length).fill(false);
  for (let i = 0; i < s1.length; i++) {
    let start = Math.max(0, i - range);
    let end = Math.min(i + range + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      m++;
      break;
    }
  }
  if (m === 0) return 0;
  let k = 0, t = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  let jaro = (m / s1.length + m / s2.length + (m - t / 2) / m) / 3;
  let p = 0.1;
  if (jaro > 0.7) {
    let l = 0;
    while (s1[l] === s2[l] && l < 4) l++;
    jaro += l * p * (1 - jaro);
  }
  return jaro;
}

function callGeminiApi_(transcript) {
  var apiKey = getRequiredProperty_(GEMINI_API_KEY_PROP);
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;
  var prompt = "Analyze the following call transcript and provide a summary in JSON format. The JSON object must have three keys: 'discussion_topics', 'key_takeaways', and 'action_items'. Each key should have a value that is an array of strings. Please provide at least 3 items for each category. IMPORTANT: In the summary, always use the correct spelling 'Audette' instead of 'Audet'.\n\nTranscript:\n" + transcript;
  var payload = {"contents": [{"parts": [{ "text": prompt }]}]};
  var options = {'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true};
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();
  if (responseCode === 200) {
    var jsonResponse = JSON.parse(responseBody);
    var contentText = jsonResponse.candidates[0].content.parts[0].text;

    // --- New, more robust JSON cleaning ---
    var match = contentText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        Logger.log('Failed to parse extracted JSON: ' + e.toString() + '\nExtracted text: ' + match[0]);
        return null;
      }
    } else {
      Logger.log('No valid JSON object found in Gemini response. Response text: ' + contentText);
      return null;
    }
  } else {
    Logger.log('Gemini API Error: ' + responseCode + ' - ' + responseBody);
    return null;
  }
}

function parseAndAppendList_(body, items) {
  if (Array.isArray(items)) {
    items.forEach(function(item) {
      body.appendListItem(item).setGlyphType(DocumentApp.GlyphType.BULLET);
    });
  }
}

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

function getOrCreateCustomerFolder_(rootFolder, customerName) {
  var folders = rootFolder.getFoldersByName(customerName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return rootFolder.createFolder(customerName);
}

function getRequiredProperty_(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error('Missing required script property: ' + name + '. Please run the appropriate setup function.');
  }
  return value;
}

function createDailyTrigger() {
  deleteTriggers_();
  ScriptApp.newTrigger('processNewCallFiles').timeBased().everyDays(1).atHour(1).create();
  Logger.log('Daily trigger created successfully.');
}

function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}
