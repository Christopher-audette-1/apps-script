# Project: Apps Script Automation

## Environment Setup
- This project uses **clasp** for local development.
- Sensitive credentials (like `creds.json`) are stored as **Environment Variables** in the Jules repository settings.
- Before running any tasks, ensure the `GOOGLE_APPLICATION_CREDENTIALS` variable is enabled.

## Authentication Workflow
- Use the `verify_clasp.sh` script in the root directory to log in to clasp using the `CLASPRC_JSON_CONTENT` environment variable.

## Task Guidelines
- **Pulling Code:** Run `clasp pull` to sync the latest from Google.
- **Pushing Code:** Run `clasp push` only after verifying changes in the Jules virtual machine.

## Connection Verification
- If you encounter authentication errors, run `bash verify_clasp.sh`.
- This script uses the `CLASP_CREDS_JSON` environment variable to authenticate.
- Ensure you are operating in the `main` branch before attempting to pull or push code.
