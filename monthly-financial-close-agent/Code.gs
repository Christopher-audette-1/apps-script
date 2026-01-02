// Code.gs

// --- Constants and Configuration (Store sensitive data in PropertiesService) ---

const SLACK_SIGNING_SECRET_KEY = 'SLACK_SIGNING_SECRET';
const SPREADSHEET_ID_KEY = 'SPREADSHEET_ID'; // Google Sheet acting as State Machine
const QBO_ACCESS_TOKEN_KEY = 'QBO_ACCESS_TOKEN'; // Placeholder for QBO OAuth token

/**
 * Retrieves a property from PropertiesService.
 * @param {string} key The key of the property to retrieve.
 * @return {string} The value of the property.
 */
function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Sets a property in PropertiesService.
 * @param {string} key The key of the property to set.
 * @param {string} value The value to set.
 */
function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

// Example usage (uncomment and run once to set initial properties, or set manually in Project Properties)
/*
function setupInitialProperties() {
  setProperty(SLACK_SIGNING_SECRET_KEY, 'YOUR_SLACK_SIGNING_SECRET'); // Replace with your actual Slack Signing Secret
  setProperty(SPREADSHEET_ID_KEY, 'YOUR_GOOGLE_SHEET_ID'); // Replace with your Google Sheet ID
  setProperty(QBO_ACCESS_TOKEN_KEY, 'YOUR_QBO_ACCESS_TOKEN'); // Replace with your QBO OAuth token
  Logger.log('Initial properties set.');
}
*/

// --- Slack Webhook Handler ---

/**
 * Handles incoming HTTP POST requests from Slack.
 * This is the main entry point for Slack Slash Commands and interactive components.
 * @param {GoogleAppsScript.Events.DoPost} e The event object containing the request data.
 * @return {GoogleAppsScript.Content.TextOutput} A JSON response for Slack.
 */
function doPost(e) {
  // 1. Verify X-Slack-Signature
  const slackSignature = e.headers['X-Slack-Signature'];
  const requestTimestamp = e.headers['X-Slack-Request-Timestamp'];
  const rawBody = e.postData.contents;
  const signingSecret = getProperty(SLACK_SIGNING_SECRET_KEY);

  if (!isValidSlackRequest(signingSecret, slackSignature, requestTimestamp, rawBody)) {
    Logger.log('Slack signature verification failed.');
    return ContentService.createTextOutput(JSON.stringify({ text: 'Signature verification failed.' })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Parse the request payload
  let payload;
  try {
    // Slack sends application/x-www-form-urlencoded for slash commands,
    // and application/json for interactive components, but the 'payload' itself is a stringified JSON.
    payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : e.parameter;
  } catch (error) {
    Logger.log('Error parsing payload: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({ text: 'Error parsing request.' })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('Received Slack payload: ' + JSON.stringify(payload));

  // 3. Route based on command or action
  if (payload.command) {
    switch (payload.command) {
      case '/close-start':
        // Placeholder for triggering data ingestion
        Logger.log('Received /close-start command from user: ' + payload.user_name);
        // Call reconcilePayroll and other ingestion functions
        reconcilePayroll(payload.channel_id); // Example: Pass channel_id to send messages back
        // In a real scenario, this would trigger background tasks and send an initial message.
        return createSlackResponse('Starting financial close data ingestion...', false);

      case '/close-prepaids':
        // Placeholder for returning prepaid checklist
        Logger.log('Received /close-prepaids command from user: ' + payload.user_name);
        const prepaidBlockKit = getPrepaidChecklist(); // This function should return Slack Block Kit JSON
        if (prepaidBlockKit) {
          return ContentService.createTextOutput(JSON.stringify(prepaidBlockKit)).setMimeType(ContentService.MimeType.JSON);
        }
        return createSlackResponse('Fetching prepaid checklist...', false);

      case '/close-audit':
        // Placeholder for revenue audit summary
        Logger.log('Received /close-audit command from user: ' + payload.user_name);
        // Call revenueAudit()
        return createSlackResponse('Running revenue audit...', false);

      case '/close-summary':
        // Placeholder for financial summary
        Logger.log('Received /close-summary command from user: ' + payload.user_name);
        // Call financialSummary()
        return createSlackResponse('Calculating financial summary...', false);

      default:
        Logger.log('Unknown command: ' + payload.command);
        return createSlackResponse('Unknown command. Please use /close-start, /close-prepaids, /close-audit, or /close-summary.', true);
    }
  } else if (payload.type === 'block_actions') {
    // Handle interactive components (e.g., button clicks from prepaid checklist)
    Logger.log('Received block action: ' + JSON.stringify(payload.actions));
    // Example: Route based on action_id
    // if (payload.actions[0].action_id === 'classify_prepaid_expense') {
    //   handlePrepaidClassification(payload);
    // }
    return ContentService.createTextOutput(''); // Acknowledge interactive request
  }

  // Fallback for unhandled request types
  Logger.log('Unhandled Slack request type: ' + JSON.stringify(payload));
  return ContentService.createTextOutput(JSON.stringify({ text: 'Request received, but not processed.' })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Verifies the Slack request signature.
 * See https://api.slack.com/docs/verifying-requests
 * @param {string} signingSecret Your Slack app's signing secret.
 * @param {string} slackSignature The X-Slack-Signature header from the request.
 * @param {string} requestTimestamp The X-Slack-Request-Timestamp header from the request.
 * @param {string} rawBody The raw request body.
 * @return {boolean} True if the signature is valid, false otherwise.
 */
function isValidSlackRequest(signingSecret, slackSignature, requestTimestamp, rawBody) {
  if (!signingSecret) {
    Logger.log('SLACK_SIGNING_SECRET is not set in PropertiesService.');
    return false;
  }

  const MAX_REQUEST_AGE_SECONDS = 60 * 5; // 5 minutes
  const currentTime = Math.floor(new Date().getTime() / 1000);

  if (Math.abs(currentTime - requestTimestamp) > MAX_REQUEST_AGE_SECONDS) {
    Logger.log('Request timestamp is too old or too new. Possible replay attack.');
    return false;
  }

  const baseString = 'v0:' + requestTimestamp + ':' + rawBody;
  const hmac = Utilities.computeHmacSha256Signature(baseString, signingSecret);
  const mySignature = 'v0=' + Utilities.base16Encode(hmac);

  // Compare signatures in a timing attack safe manner
  return secureCompare(slackSignature, mySignature);
}

/**
 * Compares two strings in a way that protects against timing attacks.
 * @param {string} a The first string.
 * @param {string} b The second string.
 * @return {boolean} True if the strings are equal, false otherwise.
 */
function secureCompare(a, b) {
  const aBytes = Utilities.newArray(a);
  const bBytes = Utilities.newArray(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

/**
 * Creates a basic Slack response in the correct format.
 * @param {string} text The text to send back to Slack.
 * @param {boolean} ephemeral If true, only the user who issued the command sees the message.
 * @return {GoogleAppsScript.Content.TextOutput} A JSON response for Slack.
 */
function createSlackResponse(text, ephemeral = true) {
  const response = {
    text: text,
    response_type: ephemeral ? 'ephemeral' : 'in_channel',
  };
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// --- Placeholder Functions for Agent Logic ---

/**
 * Placeholder function for reconciling payroll data from Gmail.
 * This function should search for emails from 'reports@rippling.com',
 * extract CSV attachments, parse them, and update the Google Sheet state machine.
 * @param {string} channelId The Slack channel ID to send messages to.
 */
function reconcilePayroll(channelId) {
  Logger.log('Executing reconcilePayroll()...');
  // 1. Search Gmail for 'reports@rippling.com' emails with CSV attachments.
  // Example: GmailApp.search('from:reports@rippling.com has:attachment newer_than:7d');

  // 2. Extract and parse CSV data.
  // Example: attachment.getDataAsString(); Utilities.parseCsv();

  // 3. Update Google Sheet (State Machine).
  const spreadsheetId = getProperty(SPREADSHEET_ID_KEY);
  if (spreadsheetId) {
    // const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('PayrollData');
    // sheet.appendRow([...parsedData]);
    Logger.log('Updated Google Sheet with payroll data.');
  } else {
    Logger.log('SPREADSHEET_ID is not set. Cannot update sheet.');
  }

  // 4. Send a confirmation message to Slack (using the channelId).
  // This would typically use Slack API to post message to channel.
  // e.g., sendSlackMessage(channelId, 'Payroll reconciliation complete!');
  Logger.log('Payroll reconciliation placeholder executed for channel: ' + channelId);
}

/**
 * Placeholder function to get a checklist of unclassified large spends from QBO.
 * Filters QBO Trial Balance for items >$2500 and formats them into a Slack Block Kit message.
 * @return {object} A Slack Block Kit JSON object, or null if an error occurs.
 */
function getPrepaidChecklist() {
  Logger.log('Executing getPrepaidChecklist()...');
  const qboAccessToken = getProperty(QBO_ACCESS_TOKEN_KEY);

  if (!qboAccessToken) {
    Logger.log('QBO_ACCESS_TOKEN is not set. Cannot fetch QBO data.');
    return createSlackResponse('Error: QBO integration not configured. Please set QBO_ACCESS_TOKEN.', true);
  }

  // --- Placeholder for QBO API Interaction ---
  // In a real scenario, you would make an authenticated call to the QBO API here.
  // Example:
  // const qboService = getQBOAuthService(); // A function to get an OAuth2 service for QBO
  // const response = UrlFetchApp.fetch('https://quickbooks.api.intuit.com/v3/company/YOUR_COMPANY_ID/reports/TrialBalance', {
  //   headers: {
  //     'Authorization': 'Bearer ' + qboAccessToken,
  //     'Accept': 'application/json',
  //   }
  // });
  // const trialBalanceData = JSON.parse(response.getContentText());

  // For now, let's simulate some data
  const simulatedTrialBalanceItems = [
    { id: 'tx101', description: 'Annual Software Subscription', amount: 3000, account: 'Software Expense' },
    { id: 'tx102', description: 'Office Furniture Purchase', amount: 4500, account: 'Fixed Assets' },
    { id: 'tx103', description: 'Consulting Services', amount: 2000, account: 'Consulting Expense' },
    { id: 'tx104', description: 'Large Marketing Campaign', amount: 6000, account: 'Marketing Expense' },
    { id: 'tx105', description: 'Utility Bill', amount: 500, account: 'Utilities' },
  ];

  const largeSpendItems = simulatedTrialBalanceItems.filter(item => item.amount > 2500);

  if (largeSpendItems.length === 0) {
    return createSlackResponse('No unclassified large spends (>$2500) found in QBO Trial Balance.', false);
  }

  // --- Format into Slack Block Kit Message ---
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '💰 Unclassified Large Spends (>$2500) 💰',
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Please classify the following transactions as `[Prepaid]` or `[Expense]`:',
      },
    },
  ];

  largeSpendItems.forEach(item => {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:* ${item.description}\n*Amount:* $${item.amount.toLocaleString()}\n*Account:* ${item.account}\n*QBO ID:* ${item.id}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Classify',
            emoji: true,
          },
          value: item.id,
          action_id: `classify_prepaid_${item.id}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '[Prepaid]',
              emoji: true,
            },
            style: 'primary',
            value: `prepaid_${item.id}`,
            action_id: `action_prepaid_${item.id}`,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '[Expense]',
              emoji: true,
            },
            value: `expense_${item.id}`,
            action_id: `action_expense_${item.id}`,
          },
        ],
      },
      {
        type: 'divider',
      }
    );
  });

  return { blocks: blocks };
}

// --- Additional Placeholder Functions (for future implementation) ---

/**
 * Placeholder for the Revenue Audit logic.
 * Matches HubSpot "Closed-Won" deals to QBO Invoices by Customer Name/Amount.
 */
function revenueAudit() {
  Logger.log('Executing revenueAudit()...');
  // Implement HubSpot API integration
  // Implement QBO API (Invoices) integration
  // Compare data and identify mismatches
}

/**
 * Placeholder for calculating Net Burn and Runway.
 * Based on cleared data in the Google Sheet.
 */
function financialSummary() {
  Logger.log('Executing financialSummary()...');
  // Read reconciled data from Google Sheet
  // Perform calculations for Net Burn and Runway
}
