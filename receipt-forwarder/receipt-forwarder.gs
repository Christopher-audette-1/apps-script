var RECEIPT_EMAIL = 'receipts@venn.ca';
var RECEIPT_FOLDER_ID_PROP = 'RECEIPT_FOLDER_ID';
var RECEIPT_LAST_RUN_PROP = 'RECEIPT_LAST_RUN';

function runReceiptForwarder() {
  var folderId = getRequiredProperty_(RECEIPT_FOLDER_ID_PROP);
  var folder = getFolderWithRetries_(folderId);
  var lastRun = getLastRun_();
  var newFiles = collectNewFiles_(folder, lastRun);

  if (!lastRun) {
    setLastRun_(new Date());
    return;
  }

  if (!newFiles.length) {
    setLastRun_(new Date());
    return;
  }

  var attachments = [];
  var fileNames = [];
  for (var i = 0; i < newFiles.length; i++) {
    var attachment = getAttachmentForFile_(newFiles[i]);
    if (!attachment) {
      continue;
    }
    attachments.push(attachment);
    fileNames.push(newFiles[i].getName());
  }

  if (attachments.length) {
    MailApp.sendEmail({
      to: RECEIPT_EMAIL,
      subject: 'New receipts (' + attachments.length + ')',
      body: buildEmailBody_(fileNames),
      attachments: attachments
    });
  }

  setLastRun_(new Date());
}

function previewReceiptForwarder() {
  var folderId = getRequiredProperty_(RECEIPT_FOLDER_ID_PROP);
  var folder = getFolderWithRetries_(folderId);
  Logger.log('Folder name: %s', folder.getName());
  var lastRun = getLastRun_();
  var newFiles = collectNewFiles_(folder, lastRun);

  if (!lastRun) {
    Logger.log('No last run found. The first run skips emailing and only sets the timestamp.');
    Logger.log('Current folder has %s file(s).', newFiles.length);
    return;
  }

  if (!newFiles.length) {
    Logger.log('No new files since %s.', lastRun.toISOString());
    return;
  }

  Logger.log('Found %s new file(s) since %s:', newFiles.length, lastRun.toISOString());
  for (var i = 0; i < newFiles.length; i++) {
    Logger.log('- %s (created %s)', newFiles[i].getName(), newFiles[i].getDateCreated().toISOString());
  }
}

function createDailyReceiptTrigger() {
  removeReceiptTriggers_();
  ScriptApp.newTrigger('runReceiptForwarder')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function removeReceiptTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runReceiptForwarder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function collectNewFiles_(folder, lastRun) {
  var files = folder.getFiles();
  var results = [];

  while (files.hasNext()) {
    var file = files.next();
    if (lastRun && file.getDateCreated() <= lastRun) {
      continue;
    }
    results.push(file);
  }

  results.sort(function (a, b) {
    return a.getDateCreated().getTime() - b.getDateCreated().getTime();
  });

  return results;
}

function getFolderWithRetries_(folderId) {
  var attempts = 0;
  var lastError = null;

  while (attempts < 3) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (err) {
      lastError = err;
      Logger.log('DriveApp failed for folder %s (attempt %s): %s', folderId, attempts + 1, err);
      Utilities.sleep(500 * Math.pow(2, attempts));
    }
    attempts += 1;
  }

  try {
    var folder = Drive.Files.get(folderId, { supportsAllDrives: true });
    return DriveApp.getFolderById(folder.id);
  } catch (err2) {
    Logger.log('Drive API failed for folder %s: %s', folderId, err2);
    throw lastError || err2;
  }
}

function getAttachmentForFile_(file) {
  var mimeType = file.getMimeType();
  if (mimeType === MimeType.GOOGLE_DOCS ||
      mimeType === MimeType.GOOGLE_SHEETS ||
      mimeType === MimeType.GOOGLE_SLIDES) {
    return file.getAs(MimeType.PDF).setName(file.getName() + '.pdf');
  }

  if (mimeType === MimeType.GOOGLE_FORMS ||
      mimeType === MimeType.GOOGLE_SITES ||
      mimeType === MimeType.GOOGLE_DRAWINGS) {
    return null;
  }

  return file.getBlob();
}

function buildEmailBody_(fileNames) {
  return 'Attached receipts:\n\n' + fileNames.join('\n');
}

function getLastRun_() {
  var value = PropertiesService.getScriptProperties().getProperty(RECEIPT_LAST_RUN_PROP);
  if (!value) {
    return null;
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function setLastRun_(date) {
  PropertiesService.getScriptProperties().setProperty(RECEIPT_LAST_RUN_PROP, date.toISOString());
}

function getRequiredProperty_(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error('Missing script property: ' + name);
  }
  return value;
}
