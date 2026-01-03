const FORWARD_EMAIL = 'audettebills@qbodocs.com';
const LABEL_TO_SEARCH = 'label:[superhuman]-ai-bill';
const FORWARDED_LABEL = 'forwarded-bill';
const REVIEWED_LABEL = 'reviewed';
const ADDITIONAL_EXCLUDE_LABELS = ['audette_invoice'];
const MIN_ATTACHMENT_SIZE_KB = 45;
const ALLOWED_CONTENT_TYPES = ['application/pdf', 'text/csv'];

function runBillForwarder() {
  let query = LABEL_TO_SEARCH;
  const allExcludeLabels = [FORWARDED_LABEL, REVIEWED_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
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
      MailApp.sendEmail({
        to: FORWARD_EMAIL,
        subject: 'Forwarded Bill (' + fileNames.length + ')',
        body: 'Attached bills:\n\n' + fileNames.join('\n'),
        attachments: attachments
      });
      threads[i].addLabel(forwardedLabel);
    } else {
      threads[i].addLabel(reviewedLabel);
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
  const allExcludeLabels = [FORWARDED_LABEL, REVIEWED_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
  for (const label of allExcludeLabels) {
    query += ` -label:${label}`;
  }
  Logger.log('Search Query: ' + query);
  var threads = GmailApp.search(query);
  Logger.log('Found ' + threads.length + ' threads matching the query.');
  
  // Simulate label creation/retrieval for logging purposes
  Logger.log('Simulating retrieval/creation of label: ' + FORWARDED_LABEL);
  Logger.log('Simulating retrieval/creation of label: ' + REVIEWED_LABEL);

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
      Logger.log('--- Email to be sent (Preview) ---');
      Logger.log('To: ' + PREVIEW_FORWARD_EMAIL);
      Logger.log('Subject: Forwarded Bill (' + fileNames.length + ')');
      Logger.log('Body: Attached bills:\n\n' + fileNames.join('\n'));
      Logger.log('Attachments (names): ' + fileNames.join(', '));
      if (skippedAttachments.length > 0) {
        Logger.log('Skipped Attachments:');
        skippedAttachments.forEach(function(skipped) {
          Logger.log('- ' + skipped.name + ': ' + skipped.reason);
        });
      }
      Logger.log('--- End Email Preview ---');

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

function createDailyBillForwarderTrigger() {
  removeBillForwarderTriggers_();
  ScriptApp.newTrigger('runBillForwarder')
    .timeBased()
    .everyDays(1)
    .atHour(9) // You can adjust the hour as needed
    .create();
}

function removeBillForwarderTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runBillForwarder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}