#!/bin/bash
set -e

# A script to reliably bootstrap a new Google Apps Script project,
# following the best practices defined in RUNBOOK_CLASP.md.

# --- Configuration ---
# The local directory for the new project (e.g., "my-new-script")
PROJECT_DIR="$1"
# The title for the new Apps Script project (e.g., "My New Script")
PROJECT_TITLE="$2"

# --- Pre-flight Checks ---
if [ -z "$PROJECT_DIR" ] || [ -z "$PROJECT_TITLE" ]; then
  echo "Usage: ./bootstrap.sh <project-directory> \"<Project Title>\""
  exit 1
fi

if [ -z "$CLASP_CLIENT_ID" ] || [ -z "$CLASP_CLIENT_SECRET" ] || [ -z "$CLASP_REFRESH_TOKEN" ]; then
  echo "Error: Required environment variables (CLASP_CLIENT_ID, CLASP_CLIENT_SECRET, CLASP_REFRESH_TOKEN) are not set."
  exit 1
fi

if [ -d "$PROJECT_DIR" ]; then
  echo "Error: Directory '$PROJECT_DIR' already exists. Please choose a different name."
  exit 1
fi

# --- Step 1: Authenticate Securely ---
echo "🔐 Generating ~/.clasprc.json from environment variables..."
cat > ~/.clasprc.json << EOF
{
  "token": {
    "access_token": "placeholder",
    "refresh_token": "$CLASP_REFRESH_TOKEN",
    "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/cloud-platform",
    "token_type": "Bearer",
    "expiry_date": 0
  },
  "oauth2ClientSettings": {
    "clientId": "$CLASP_CLIENT_ID",
    "clientSecret": "$CLASP_CLIENT_SECRET",
    "redirectUri": "http://localhost"
  }
}
EOF
echo "✅ Authentication file created."

# Verify authentication by checking status (suppress output)
clasp status > /dev/null

# --- Step 2: Create Project in /tmp (The Workaround) ---
echo "🏗️ Creating new Apps Script project in a temporary directory..."
TEMP_DIR="/tmp/clasp-bootstrap-$(date +%s)"
mkdir -p "$TEMP_DIR"
# Use a subshell to avoid changing the script's main directory
(cd "$TEMP_DIR" && clasp create --type standalone --title "$PROJECT_TITLE")
echo "✅ Project created successfully."

# --- Step 3: Move Project Files into Repo ---
echo "🚚 Moving project files to './$PROJECT_DIR'..."
mkdir -p "$PROJECT_DIR"
mv "$TEMP_DIR"/.clasp.json "$TEMP_DIR"/appsscript.json "$PROJECT_DIR/"
rm -rf "$TEMP_DIR"
echo "✅ Files moved."

# --- Step 4: Add Starter Code and Push ---
echo "📝 Adding starter Code.gs file..."
cat > "$PROJECT_DIR/Code.gs" <<'EOF'
function helloWorld() {
  Logger.log("Project bootstrapped successfully!");
}
EOF

echo "🚀 Pushing initial version to Apps Script..."
# Use the -P flag to be explicit about the project directory
clasp push -P "$PROJECT_DIR"
echo "✅ Initial push complete."

# --- Step 5: Verify and Report ---
echo "🔍 Verifying project and providing final details..."
SCRIPT_ID=$(grep 'scriptId' "$PROJECT_DIR/.clasp.json" | cut -d '"' -f 4)

echo "---"
echo "🎉 Bootstrap Complete! 🎉"
echo ""
echo "Project Directory: ./$PROJECT_DIR"
echo "Apps Script URL:   https://script.google.com/d/$SCRIPT_ID/edit"
echo ""
echo "You can now start developing in the './$PROJECT_DIR' directory."
echo "---"