var GMAIL_RECEIPT_EMAIL = 'receipts@venn.ca';
var GMAIL_RECEIPT_LABEL_NAME = 'forwarded-receipt';

function runGmailReceiptForwarder() {
  var label = getOrCreateGmailLabel_();
  var threads = searchForGmailReceipts_(label);

  if (!threads.length) {
    return;
  }

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      if (message.getAttachments().length > 0) {
        message.forward(GMAIL_RECEIPT_EMAIL);
      }
    }
    thread.addLabel(label);
  }
}

function previewGmailReceiptForwarder() {
  var label = getOrCreateGmailLabel_();
  var threads = searchForGmailReceipts_(label);

  Logger.log('Found %s new receipt thread(s).', threads.length);
  for (var i = 0; i < threads.length; i++) {
    Logger.log('- %s', threads[i].getFirstMessageSubject());
  }
}

function searchForGmailReceipts_(label, max) {
  var query = 'subject:(receipt OR invoice OR "order confirmation") -subject:(re: OR fwd:) has:attachment -from:"Audette Analytics" -label:' + label.getName();
  return GmailApp.search(query, 0, max || 500);
}

function getOrCreateGmailLabel_() {
  var label = GmailApp.getUserLabelByName(GMAIL_RECEIPT_LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(GMAIL_RECEIPT_LABEL_NAME);
  }
  return label;
}

function createDailyGmailReceiptTrigger() {
  removeGmailReceiptTriggers_();
  ScriptApp.newTrigger('runGmailReceiptForwarder')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function removeGmailReceiptTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runGmailReceiptForwarder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
