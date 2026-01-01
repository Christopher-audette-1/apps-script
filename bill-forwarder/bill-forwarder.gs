const FORWARD_EMAIL = 'audettebills@qbodocs.com';
const LABEL_TO_SEARCH = 'label:[superhuman]-ai-bill';
const EXCLUDE_LABEL = 'forwarded-bill';
const ADDITIONAL_EXCLUDE_LABELS = ['audette_invoice'];

function runBillForwarder() {
  let query = LABEL_TO_SEARCH;
  const allExcludeLabels = [EXCLUDE_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
  for (const label of allExcludeLabels) {
    query += ` -label:${label}`;
  }
  var threads = GmailApp.search(query);
  
  var forwardedLabel = GmailApp.getUserLabelByName(EXCLUDE_LABEL);
  if (!forwardedLabel) {
    forwardedLabel = GmailApp.createLabel(EXCLUDE_LABEL);
  }

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var attachments = [];
    var fileNames = [];

    for (var j = 0; j < messages.length; j++) {
      var messageAttachments = messages[j].getAttachments();
      for (var k = 0; k < messageAttachments.length; k++) {
        attachments.push(messageAttachments[k]);
        fileNames.push(messageAttachments[k].getName());
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
    }
  }
}

/**
 * Preview function for testing the bill forwarding logic without actually sending emails or modifying labels.
 * Logs the intended actions to the Apps Script console.
 */
function previewBillForwarder() {
  const PREVIEW_FORWARD_EMAIL = FORWARD_EMAIL; // Use the same target email for logging
  const PREVIEW_EXCLUDE_LABEL = EXCLUDE_LABEL; // Use the same label for logging

  Logger.log('--- Starting Bill Forwarder Preview ---');

  let query = LABEL_TO_SEARCH;
  const allExcludeLabels = [EXCLUDE_LABEL, ...ADDITIONAL_EXCLUDE_LABELS];
  for (const label of allExcludeLabels) {
    query += ` -label:${label}`;
  }
  Logger.log('Search Query: ' + query);
  var threads = GmailApp.search(query);
  Logger.log('Found ' + threads.length + ' threads matching the query.');
  
  // Simulate label creation/retrieval for logging purposes
  Logger.log('Simulating retrieval/creation of label: ' + PREVIEW_EXCLUDE_LABEL);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var attachments = [];
    var fileNames = [];

    for (var j = 0; j < messages.length; j++) {
      var messageAttachments = messages[j].getAttachments();
      for (var k = 0; k < messageAttachments.length; k++) {
        attachments.push(messageAttachments[k]);
        fileNames.push(messageAttachments[k].getName());
      }
    }

    if (attachments.length > 0) {
      Logger.log('--- Email to be sent (Preview) ---');
      Logger.log('To: ' + PREVIEW_FORWARD_EMAIL);
      Logger.log('Subject: Forwarded Bill (' + fileNames.length + ')');
      Logger.log('Body: Attached bills:\n\n' + fileNames.join('\n'));
      Logger.log('Attachments (names): ' + fileNames.join(', '));
      Logger.log('--- End Email Preview ---');

      Logger.log('Simulating adding label "' + PREVIEW_EXCLUDE_LABEL + '" to thread ID: ' + threads[i].getId());
    } else {
      Logger.log('No attachments found for thread ID: ' + threads[i].getId() + '. Skipping.');
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