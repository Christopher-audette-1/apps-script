# Project: Apps Script Automation

## Environment Setup
- This project uses **clasp** for local development.
- Sensitive credentials (like `creds.json`) are stored as **Environment Variables** in the Jules repository settings.
- Before running any tasks, ensure the `GOOGLE_APPLICATION_CREDENTIALS` variable is enabled.

## Authentication Workflow
1. Use the command `jules login` to establish your session if needed.
2. If you need to interact with the Apps Script API, use the custom Client ID from the Environment Variables.
3. Never output raw credentials or tokens into the chat logs.

## Task Guidelines
- **Pulling Code:** Run `clasp pull` to sync the latest from Google.
- **Pushing Code:** Run `clasp push` only after verifying changes in the Jules virtual machine.

## Connection Verification
- If you encounter authentication errors, run `bash verify_clasp.sh`.
- This script uses the `CLASP_CREDS_JSON` environment variable to authenticate.
- Ensure you are operating in the `main` branch before attempting to pull or push code.
