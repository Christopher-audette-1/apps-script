# Manual Google Apps Script Setup

Since `clasp` authentication is not currently working, you'll need to create the Google Apps Script project manually. Here's how:

## 1. Create a New Apps Script Project

1.  Go to the Google Apps Script dashboard: [https://script.google.com/home](https://script.google.com/home)
2.  Click **New project**.
3.  Give your project a name, such as "Audette Financial Close Agent".

## 2. Add the Code

1.  In the Apps Script editor, you'll see a file named `Code.gs`.
2.  Delete the default content of this file.
3.  Copy the entire contents of the `financial-close-agent/Code.gs` file from this repository and paste it into the editor.
4.  Save the project.

## 3. Set Up Script Properties

The script uses `PropertiesService` to store sensitive information like your Slack signing secret. You'll need to add this manually.

1.  In the Apps Script editor, go to **Project Settings** (the gear icon on the left).
2.  Scroll down to the **Script Properties** section and click **Add script property**.
3.  Add the following property:
    *   **Property:** `SLACK_SIGNING_SECRET`
    *   **Value:** *Your Slack app's signing secret*
4.  Save the script properties.

## 4. Deploy the Web App

Follow the deployment instructions in `slack_setup_instructions.md` to deploy your script as a web app and get the URL for your Slack commands.
