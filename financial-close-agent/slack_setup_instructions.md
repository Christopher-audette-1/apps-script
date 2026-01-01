# Slack Slash Command Setup Instructions

To use the Financial Close Agent, you'll need to configure four Slash Commands in your Slack App.

## 1. Get Your Webhook URL

First, you'll need to deploy your Google Apps Script as a web app.

1.  Open your Google Apps Script project.
2.  Click **Deploy** > **New deployment**.
3.  For **Select type**, choose **Web app**.
4.  In the **Deployment configuration** section:
    *   Give your deployment a description (e.g., "Financial Close Agent v1").
    *   For **Execute as**, select **Me**.
    *   For **Who has access**, select **Anyone**.
5.  Click **Deploy**.
6.  Copy the **Web app URL**. You'll need this for the next step.

## 2. Create the Slash Commands

In your Slack App configuration, go to **Slash Commands** and create a new command for each of the following:

### /close-start

*   **Command:** `/close-start`
*   **Request URL:** *Paste your Web app URL here*
*   **Short Description:** Starts the financial close process.
*   **Usage Hint:** `[Starts the financial close process]`

### /close-prepaids

*   **Command:** `/close-prepaids`
*   **Request URL:** *Paste your Web app URL here*
*   **Short Description:** Gets a checklist of prepaid expenses.
*   **Usage Hint:** `[Gets a checklist of prepaid expenses]`

### /close-audit

*   **Command:** `/close-audit`
*   **Request URL:** *Paste your Web app URL here*
*   **Short Description:** Audits HubSpot vs. QBO invoices.
*   **Usage Hint:** `[Audits HubSpot vs. QBO invoices]`

### /close-summary

*   **Command:** `/close-summary`
*   **Request URL:** *Paste your Web app URL here*
*   **Short Description:** Calculates Net Burn and Runway.
*   **Usage Hint:** `[Calculates Net Burn and Runway]`
