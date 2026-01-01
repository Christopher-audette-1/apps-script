#!/usr/bin/env bash
# bootstrap_clasp_project.sh
#
# Secure, repeatable bootstrap for Google Apps Script + clasp:
# - Generates ~/.clasprc.json from env vars (never prints secrets)
# - Creates a standalone Apps Script project OUTSIDE repo tree (/tmp) to avoid "Project file already exists"
# - Moves project metadata into your target directory
# - Creates a starter Code.gs (optional)
# - Pushes to Apps Script
#
# Usage:
#   export CLASP_CLIENT_ID="..."
#   export CLASP_CLIENT_SECRET="..."
#   export CLASP_REFRESH_TOKEN="..."
#   ./bootstrap_clasp_project.sh \
#     --title "Service Validator" \
#     --target-dir "$HOME/apps/apps-script/service-validator-new" \
#     --create-starter
#
# Notes:
# - Does NOT run `clasp login`.
# - Does NOT print env vars or ~/.clasprc.json.
# - Requires: node + npm + @google/clasp installed (or it will install clasp globally).

set -euo pipefail

TITLE=""
TARGET_DIR=""
CREATE_STARTER="false"
FORCE="false"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*" >&2; }

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Missing required env var: $name"
}

usage() {
  cat >&2 <<EOF
Usage:
  $0 --title "Project Title" --target-dir "/path/to/dir" [--create-starter] [--force]

Options:
  --title           Apps Script project title (required)
  --target-dir      Destination directory for the clasp project (required)
  --create-starter  Create starter Code.gs if no code files exist
  --force           If target-dir is non-empty, abort unless --force is set
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE="${2:-}"; shift 2 ;;
    --target-dir) TARGET_DIR="${2:-}"; shift 2 ;;
    --create-starter) CREATE_STARTER="true"; shift ;;
    --force) FORCE="true"; shift ;;
    -h|--help) usage ;;
    *) die "Unknown argument: $1 (use --help)" ;;
  esac
done

[[ -n "$TITLE" ]] || usage
[[ -n "$TARGET_DIR" ]] || usage

require_env "CLASP_CLIENT_ID"
require_env "CLASP_CLIENT_SECRET"
require_env "CLASP_REFRESH_TOKEN"

# Ensure clasp exists
if ! command -v clasp >/dev/null 2>&1; then
  info "clasp not found; installing globally via npm..."
  command -v npm >/dev/null 2>&1 || die "npm not found. Install Node.js + npm first."
  npm install -g @google/clasp
fi

# Write ~/.clasprc.json safely (no printing)
info "Writing ~/.clasprc.json from environment variables (secrets not printed)..."
umask 077
cat > "$HOME/.clasprc.json" <<EOF
{
  "token": {
    "access_token": "placeholder",
    "refresh_token": "${CLASP_REFRESH_TOKEN}",
    "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/cloud-platform",
    "token_type": "Bearer",
    "expiry_date": 0
  },
  "oauth2ClientSettings": {
    "clientId": "${CLASP_CLIENT_ID}",
    "clientSecret": "${CLASP_CLIENT_SECRET}",
    "redirectUri": "http://localhost"
  }
}
EOF

# Quick auth sanity check (safe output)
info "Verifying clasp can authenticate..."
clasp status >/dev/null 2>&1 || die "clasp status failed. Auth/config is not working."

# Prepare target dir
mkdir -p "$TARGET_DIR"
if [[ "$(ls -A "$TARGET_DIR" 2>/dev/null | wc -l | tr -d ' ')" != "0" ]]; then
  if [[ "$FORCE" != "true" ]]; then
    die "Target dir is not empty: $TARGET_DIR (use --force to allow)"
  fi
  info "Target dir is not empty but --force set; continuing."
fi

# Create in /tmp to avoid repo-tree collisions
TMP_DIR="$(mktemp -d /tmp/clasp-bootstrap.XXXXXX)"
cleanup() { rm -rf "$TMP_DIR" >/dev/null 2>&1 || true; }
trap cleanup EXIT

info "Creating Apps Script project in temp dir: $TMP_DIR"
pushd "$TMP_DIR" >/dev/null

# Create standalone Apps Script project
# (Do not use --rootDir here; we want clasp to create .clasp.json in TMP_DIR)
CREATE_OUT="$(clasp create --type standalone --title "$TITLE" 2>&1)" || {
  echo "$CREATE_OUT" >&2
  die "clasp create failed."
}

# Extract scriptId from .clasp.json for display
SCRIPT_ID="$(python3 - <<'PY'
import json, os
p=os.path.join(os.getcwd(), ".clasp.json")
with open(p,"r",encoding="utf-8") as f:
    d=json.load(f)
print(d.get("scriptId",""))
PY
)"
[[ -n "$SCRIPT_ID" ]] || die "Could not read scriptId from temp .clasp.json"

info "Created scriptId: $SCRIPT_ID"

# Move metadata into target dir (without printing sensitive data)
info "Moving project files into target dir: $TARGET_DIR"
# Copy dotfiles safely (macOS mv of '.*' can include '.' and '..' in some shells)
for f in "$TMP_DIR"/.clasp.json "$TMP_DIR"/appsscript.json; do
  [[ -f "$f" ]] && cp -f "$f" "$TARGET_DIR/"
done

# Optionally create starter file if no code exists
if [[ "$CREATE_STARTER" == "true" ]]; then
  if ! ls "$TARGET_DIR"/*.gs "$TARGET_DIR"/*.js "$TARGET_DIR"/*.ts >/dev/null 2>&1; then
    info "Creating starter Code.gs..."
    cat > "$TARGET_DIR/Code.gs" <<'EOF'
function testConnection() {
  Logger.log("Bootstrapped and wired up.");
  return true;
}
EOF
  else
    info "Code files already exist in target; skipping starter creation."
  fi
fi

# Push from target dir
info "Pushing to Apps Script from: $TARGET_DIR"
popd >/dev/null
pushd "$TARGET_DIR" >/dev/null

PUSH_OUT="$(clasp push 2>&1)" || {
  echo "$PUSH_OUT" >&2
  die "clasp push failed."
}

# Safe confirmation
echo ""
echo "SUCCESS"
echo "  Title:     $TITLE"
echo "  Script ID: $SCRIPT_ID"
echo "  Target:    $TARGET_DIR"
echo ""
echo "Next:"
echo "  1) Open the Apps Script editor for this project:"
echo "     https://script.google.com/d/${SCRIPT_ID}/edit"
echo "  2) Refresh the file tree; you should see appsscript.json and any .gs/.js/.ts files you created."
echo ""

popd >/dev/null
