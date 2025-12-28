var GMAIL_RECEIPT_EMAIL = 'receipts@venn.ca';
var GMAIL_RECEIPT_LABEL_NAME = 'forwarded-receipt';
var CARD_NUMBERS = ['8287', '3174', '2735', '0764'];

function bodyContainsCardNumber_(body) {
  for (var i = 0; i < CARD_NUMBERS.length; i++) {
    if (body.indexOf(CARD_NUMBERS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

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
      var body = message.getPlainBody();
      if (bodyContainsCardNumber_(body)) {
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
    var thread = threads[i];
    var message = thread.getMessages()[0];
    var body = message.getPlainBody();
    Logger.log('- %s', message.getSubject());
    if (bodyContainsCardNumber_(body)) {
      Logger.log('  --> Card number found. Would be forwarded.');
    } else {
      Logger.log('  --> No card number found. Would be skipped.');
    }
  }
}

function searchForGmailReceipts_(label, max) {
  var query = 'subject:("your receipt" OR invoice OR "order confirmation") -subject:(re: OR fwd: OR "[") -from:"Audette Analytics" -label:' + label.getName();
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
