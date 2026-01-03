const FORWARD_EMAIL = 'audettebills@qbodocs.com';
const LABEL_TO_SEARCH = 'label:[superhuman]-ai-bill';
const FORWARDED_LABEL = 'forwarded-bill';
const REVIEWED_LABEL = 'reviewed';
const SEND_ERROR_LABEL = 'send-error'; // New constant
const ADDITIONAL_EXCLUDE_LABELS = ['audette_invoice'];
const MIN_ATTACHMENT_SIZE_KB = 45;
const ALLOWED_CONTENT_TYPES = ['application/pdf', 'text/csv'];

function runBillForwarder() {
  let query = LABEL_TO_SEARCH;
  const allExcludeLabels = [FORWARDED_LABEL, REVIEWED_LABEL, SEND_ERROR_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
  for (const label of allExcludeLabels) {
    query += ` -label:${label}`;
  }
  var threads = GmailApp.search(query);
  
  var forwardedLabel = GmailApp.getUserLabelByName(FORWARDED_LABEL);
  if (!forwardedLabel) {
    forwardedLabel = GmailApp.createLabel(FORWARDED_LABEL);
  }
  var reviewedLabel = GmailApp.getUserLabelByName(REVIEWED_LABEL);
  if (!reviewedLabel) {
    reviewedLabel = GmailApp.createLabel(REVIEWED_LABEL);
  }
  var sendErrorLabel = GmailApp.getUserLabelByName(SEND_ERROR_LABEL); // Get or create new label
  if (!sendErrorLabel) {
    sendErrorLabel = GmailApp.createLabel(SEND_ERROR_LABEL);
  }

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var attachments = [];
    var fileNames = [];
    var seenAttachments = {}; // Prevent duplicates

    for (var j = 0; j < messages.length; j++) {
      var messageAttachments = messages[j].getAttachments();
      for (var k = 0; k < messageAttachments.length; k++) {
        var attachment = messageAttachments[k];
        var attachmentName = attachment.getName();
        var attachmentContentType = attachment.getContentType();

        if (seenAttachments[attachmentName]) {
          continue;
        }

        var isAllowed = ALLOWED_CONTENT_TYPES.includes(attachmentContentType) ||
                        (attachmentContentType === 'application/octet-stream' && (attachmentName.toLowerCase().endsWith('.pdf') || attachmentName.toLowerCase().endsWith('.csv')));

        if (attachment.getSize() < MIN_ATTACHMENT_SIZE_KB * 1024) {
          continue;
        }
        if (!isAllowed) {
          continue;
        }
        
        seenAttachments[attachmentName] = true;
        attachments.push(attachment);
        fileNames.push(attachmentName);
      }
    }

    if (attachments.length > 0) {
      var lastMessage = messages[messages.length - 1];
      Logger.log('Attempting to forward thread ID: ' + threads[i].getId() + ' with ' + fileNames.length + ' attachments.');
      try {
        lastMessage.forward(FORWARD_EMAIL, {
          attachments: attachments
        });
        Logger.log('Thread forwarded successfully: ' + threads[i].getId());
        threads[i].addLabel(forwardedLabel);
        threads[i].moveToArchive();
      } catch (e) {
        Logger.log('Error forwarding thread: ' + threads[i].getId() + ' - ' + e.toString());
        threads[i].addLabel(sendErrorLabel);
      }
    } else {
      threads[i].addLabel(reviewedLabel);
      threads[i].moveToArchive();
    }
  }
}

/**
 * Preview function for testing the bill forwarding logic without actually sending emails or modifying labels.
 * Logs the intended actions to the Apps Script console.
 */
function previewBillForwarder() {
  const PREVIEW_FORWARD_EMAIL = FORWARD_EMAIL;

  Logger.log('--- Starting Bill Forwarder Preview ---');

  let query = LABEL_TO_SEARCH;
  const allExcludeLabels = [FORWARDED_LABEL, REVIEWED_LABEL, SEND_ERROR_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
  for (const label of allExcludeLabels) {
    query += ` -label:${label}`;
  }
  Logger.log('Search Query: ' + query);
  var threads = GmailApp.search(query);
  Logger.log('Found ' + threads.length + ' threads matching the query.');
  
  // Simulate label creation/retrieval for logging purposes
  Logger.log('Simulating retrieval/creation of label: ' + FORWARDED_LABEL);
  Logger.log('Simulating retrieval/creation of label: ' + REVIEWED_LABEL);
  Logger.log('Simulating retrieval/creation of label: ' + SEND_ERROR_LABEL);


  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var attachments = [];
    var fileNames = [];
    var skippedAttachments = [];
    var seenAttachments = {}; // Prevent duplicates

    for (var j = 0; j < messages.length; j++) {
      var messageAttachments = messages[j].getAttachments();
      for (var k = 0; k < messageAttachments.length; k++) {
        var attachment = messageAttachments[k];
        var attachmentName = attachment.getName();
        var attachmentSize = attachment.getSize();
        var attachmentContentType = attachment.getContentType();
        
        if (seenAttachments[attachmentName]) {
          continue;
        }
        
        var isAllowed = true;
        var reason = '';

        if (attachmentSize < MIN_ATTACHMENT_SIZE_KB * 1024) {
          isAllowed = false;
          reason = 'Too small (' + Math.round(attachmentSize / 1024) + ' KB)';
        } else {
          var isAllowedType = ALLOWED_CONTENT_TYPES.includes(attachmentContentType) ||
                                (attachmentContentType === 'application/octet-stream' && (attachmentName.toLowerCase().endsWith('.pdf') || attachmentName.toLowerCase().endsWith('.csv')));
          if (!isAllowedType) {
            isAllowed = false;
            reason = 'Disallowed content type (' + attachmentContentType + ')';
          }
        }

        if (isAllowed) {
          seenAttachments[attachmentName] = true;
          attachments.push(attachment);
          fileNames.push(attachmentName);
        } else {
          skippedAttachments.push({ name: attachmentName, reason: reason });
        }
      }
    }

    if (attachments.length > 0) {
      Logger.log('--- Thread to be forwarded (Preview) ---');
      Logger.log('To: ' + PREVIEW_FORWARD_EMAIL);
      Logger.log('Original Thread Subject: ' + threads[i].getFirstMessageSubject());
      Logger.log('Attachments that will be included ('+ fileNames.length +'): ' + fileNames.join(', '));
      if (skippedAttachments.length > 0) {
        Logger.log('Skipped Attachments:');
        skippedAttachments.forEach(function(skipped) {
          Logger.log('- ' + skipped.name + ': ' + skipped.reason);
        });
      }
      Logger.log('--- End Forward Preview ---');

      Logger.log('Simulating adding label "' + FORWARDED_LABEL + '" to thread ID: ' + threads[i].getId());
    } else {
      Logger.log('No qualifying attachments found for thread ID: ' + threads[i].getId() + '. Skipping email but applying reviewed label.');
       if (skippedAttachments.length > 0) {
        Logger.log('Skipped Attachments:');
        skippedAttachments.forEach(function(skipped) {
          Logger.log('- ' + skipped.name + ': ' + skipped.reason);
        });
      }
      Logger.log('Simulating adding label "' + REVIEWED_LABEL + '" to thread ID: ' + threads[i].getId());
    }
  }
  Logger.log('--- Bill Forwarder Preview Finished ---');
}

function createFrequentBillForwarderTrigger() {
  removeTriggers_();
  ScriptApp.newTrigger('runBillForwarder')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function removeTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runBillForwarder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
