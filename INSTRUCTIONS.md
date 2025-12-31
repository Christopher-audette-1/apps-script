# Instructions for "Send to Gamma" Google Apps Script

This document provides instructions on how to deploy and use the "Send to Gamma" Google Apps Script with your Google Doc template.

## One-Time Setup

These steps need to be performed once to link the script to your Google account and configure it.

### 1. Create a new Google Apps Script project

1.  Go to [script.google.com](https://script.google.com) and click on **New project**.
2.  Give the project a name, for example, "Send to Gamma".
3.  You will see a default `Code.gs` file.

### 2. Add the script files

You will need to add the following files to your Apps Script project:

*   `send-to-gamma.gs`
*   `gamma-template-dialog.html`
*   `appsscript.json`

For each file:

1.  Click on the `+` icon in the "Files" sidebar and choose the file type (`Script` for `.gs` files, `HTML` for `.html` files, and `JSON` for `appsscript.json`).
2.  Name the file exactly as listed above.
3.  Copy the content from the local files you have into the corresponding files in the Apps Script editor.

### 3. Link the script to your Google Doc template

1.  Open your Google Doc template (the one you provided the link for).
2.  Go to **Extensions > Apps Script**. This will open the Apps Script project that is bound to the document.
3.  Copy the **Script ID** from the project you created in step 1. You can find this in **Project Settings > Script ID**.
4.  In the Apps Script project bound to the doc, open the `appsscript.json` file.
5.  Add a `dependencies` section to the `appsscript.json` file to include the script you created as a library. It should look like this:

```json
{
  "timeZone": "America/New_York",
  "dependencies": {
    "libraries": [{
      "userSymbol": "SendToGamma",
      "libraryId": "YOUR_SCRIPT_ID",
      "version": "0"
    }]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

Replace `YOUR_SCRIPT_ID` with the Script ID you copied.

6. In the `Code.gs` file of the script bound to the doc, add the following code:

```javascript
function onOpen() {
  SendToGamma.onOpen();
}

function showGammaTemplateDialog() {
  SendToGamma.showGammaTemplateDialog();
}

function sendToGamma(gammaTemplate) {
  SendToGamma.sendToGamma(gammaTemplate);
}
```

This will make the "Send to Gamma" menu appear in your Google Doc template and in all copies made from it.

### 4. Configure the Gamma API call

In the `send-to-gamma.gs` file, you need to update the `callGammaApi` function with your actual Gamma API URL and authentication details.

## Using the "Send to Gamma" feature

1.  Open a Google Doc that has been created from your template.
2.  Go to the "Send to Gamma" menu and click on "Send".
3.  A dialog will appear asking for the Gamma Template to use. Enter the name of the template and click "Send".
4.  The script will then extract the content of your document, send it to Gamma, and insert the URL of the newly created Gamma presentation back into your document.

## Style Guide

For the best results, format your presentation outline according to the `gamma-style-guide.md` file.
