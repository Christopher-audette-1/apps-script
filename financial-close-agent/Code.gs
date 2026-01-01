// The 'doPost' function is the entry point for all Slack commands.
function doPost(e) {
  if (!isValidRequest(e)) {
    // Return a JSON response for errors as well, as Slack expects it.
    return ContentService.createTextOutput(JSON.stringify({ text: "Invalid request signature." })).setMimeType(ContentService.MimeType.JSON);
  }

  const command = e.parameter.command;
  let response;

  switch (command) {
    case "/close-start":
      response = { text: "Starting the financial close process..." };
      break;
    case "/close-prepaids":
      response = getPrepaidChecklist();
      break;
    case "/close-audit":
      response = { text: "Auditing HubSpot vs. QBO invoices..." };
      break;
    case "/close-summary":
      response = { text: "Calculating Net Burn and Runway..." };
      break;
    default:
      response = { text: `Unknown command: ${command}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// This function verifies the Slack signature to ensure the request is legitimate.
function isValidRequest(e) {
  const properties = PropertiesService.getScriptProperties();
  const slackSigningSecret = properties.getProperty("SLACK_SIGNING_SECRET");
  const timestamp = e.requestHeaders["x-slack-request-timestamp"];
  const signature = e.requestHeaders["x-slack-signature"];
  const requestBody = e.postData.contents;

  // Protect against replay attacks
  if (Math.abs(new Date().getTime() / 1000 - timestamp) > 60 * 5) {
    return false;
  }

  const baseString = "v0:" + timestamp + ":" + requestBody;
  const hash = Utilities.computeHmacSha256Signature(baseString, slackSigningSecret);
  const computedSignature = "v0=" + hash.map(byte => ("0" + (byte & 0xFF).toString(16)).slice(-2)).join("");

  return computedSignature === signature;
}

// Placeholder function to reconcile payroll from Gmail.
function reconcilePayroll() {
  Logger.log("Reconciling payroll...");
  // In a real implementation, this would connect to Gmail, find Rippling emails,
  // parse the CSV, and update the Google Sheet.
}

// This function gets a checklist of prepaid expenses from QBO.
function getPrepaidChecklist() {
  // This is a mocked response. In a real implementation, this would make a call
  // to the QBO API to get the Trial Balance.
  const mockQBOData = [
    { name: "Insurance", amount: 3000 },
    { name: "Software Subscription", amount: 5000 },
    { name: "Rent", amount: 10000 },
    { name: "Office Supplies", amount: 500 }, // Below threshold
    { name: "Web Hosting", amount: 250 }      // Below threshold
  ];

  // Filter for transactions > $2500
  const transactionsToReview = mockQBOData.filter(item => item.amount > 2500);

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Prepaid Expense Checklist*"
      }
    },
    {
      type: "divider"
    }
  ];

  if (transactionsToReview.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No transactions over $2500 found to review."
      }
    });
  } else {
    transactionsToReview.forEach(item => {
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Vendor:* ${item.name}\n*Amount:* $${item.amount}`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Prepaid",
                emoji: true
              },
              style: "primary",
              value: `prepaid-${item.name}`
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Expense",
                emoji: true
              },
              style: "danger",
              value: `expense-${item.name}`
            }
          ]
        }
      );
    });
  }

  return { blocks: blocks };
}
