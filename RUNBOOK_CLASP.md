Runbook: Apps Script + clasp (Auth, Create, Push) — What Broke, How We Fixed It, How We Operate Going Forward

Summary

We lost time because we treated clasp like it supported “environment variable auth” and because clasp create behaved inconsistently (reporting “Project file already exists” in an empty folder). The reliable workflow is:
	1.	Generate ~/.clasprc.json locally from env vars (never paste secrets into chat).
	2.	If clasp create fails inside the repo, create the Apps Script project outside the repo (e.g., /tmp), then move the generated files into the repo folder.
	3.	Add at least one real code file (Code.gs) before expecting anything to show in the editor.
	4.	Always verify you’re linked to the right Script ID before pushing.

⸻

What was wrong (root causes)

RC1 — Wrong mental model for clasp authentication
	•	We tried to get clasp to authenticate “from env vars”:
	•	CLASP_CLIENT_ID
	•	CLASP_CLIENT_SECRET
	•	CLASP_REFRESH_TOKEN
	•	clasp does not support auth directly from environment variables.
	•	clasp only authenticates via ~/.clasprc.json, using a very specific JSON schema.
	•	Attempts to use other JSON shapes or pass tokens via --creds caused clasp to misinterpret the credential type (e.g., expecting service account fields like client_email) and fail.

Correct principle: env vars are inputs to generate ~/.clasprc.json locally — nothing more.

⸻

RC2 — clasp create bug/quirk inside an existing clasp project tree
	•	We ran clasp create inside a folder under a repo that already had clasp/project state elsewhere (a parent .clasp.json / clasp context).
	•	The target folder was demonstrably empty, but clasp create repeatedly returned:
	•	Project file already exists.
	•	Creating the project outside the repo tree (in /tmp) worked immediately.

Correct principle: treat clasp create as context-sensitive; if it fails in-repo with that error, stop fighting it and use the /tmp workaround.

⸻

RC3 — Misreading “Script is already up to date” and “untracked .clasp.json”
	•	clasp push saying “Script is already up to date” is not proof your script has code—if you only have appsscript.json, the editor can look empty.
	•	.clasp.json showing as “untracked” in clasp status is normal. .clasp.json is local metadata and is not pushed to Apps Script.

Correct principle: to see files in the Apps Script editor, you must have actual code files (e.g., Code.gs) and push them.

⸻

The fix (the workflow that worked)

Step 1 — Authenticate securely (no secrets in chat)

Never paste credentials into chat. Use env vars to write ~/.clasprc.json locally:

cat > ~/.clasprc.json << 'EOF'
{
  "token": {
    "access_token": "placeholder",
    "refresh_token": "'"$CLASP_REFRESH_TOKEN"'",
    "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/cloud-platform",
    "token_type": "Bearer",
    "expiry_date": 0
  },
  "oauth2ClientSettings": {
    "clientId": "'"$CLASP_CLIENT_ID"'",
    "clientSecret": "'"$CLASP_CLIENT_SECRET"'",
    "redirectUri": "http://localhost"
  }
}
EOF

Then confirm clasp works (without printing secrets):

clasp status


⸻

Step 2 — Create the Apps Script project OUTSIDE the repo tree

If clasp create fails in-repo (especially “Project file already exists”), do this:

rm -rf /tmp/clasp-sv
mkdir -p /tmp/clasp-sv
cd /tmp/clasp-sv

clasp create --type standalone --title "Service Validator"

This produces:
	•	.clasp.json (contains scriptId)
	•	appsscript.json

⸻

Step 3 — Move the created project files into the repo folder

mkdir -p ~/apps/apps-script/service-validator-new
mv /tmp/clasp-sv/* ~/apps/apps-script/service-validator-new/
mv /tmp/clasp-sv/.* ~/apps/apps-script/service-validator-new/ 2>/dev/null || true


⸻

Step 4 — Add real code and push

From the repo folder:

cd ~/apps/apps-script/service-validator-new

cat > Code.gs <<'EOF'
function testConnection() {
  Logger.log("Service Validator is wired up");
  return true;
}
EOF

clasp push

Now the Apps Script editor will actually show files.

⸻

Step 5 — Verify you’re pushing to the right remote project

Always verify before doing real work:

cat .clasp.json
clasp status

Confirm the scriptId in .clasp.json matches the project you opened in the browser.

⸻

Forward rules (how to behave moving forward)

Security rules
	•	No secrets in chat, Slack, PRs, or logs.
	•	Do not print ~/.clasprc.json.
	•	Do not run printenv on secret vars in shared logs.
	•	env vars are acceptable only for local file generation.

clasp rules
	•	Do not run interactive clasp login in non-interactive environments.
	•	If clasp create fails in-repo with “Project file already exists”:
	•	Stop retrying.
	•	Create in /tmp, then move files.
	•	.clasp.json “untracked” in status is normal and not a blocker.
	•	“Script is already up to date” can be meaningless if you haven’t created code files yet.

Operational sanity checks

Before you claim “deployed”:
	1.	cat .clasp.json → confirm scriptId
	2.	ls -la → confirm at least one .gs / .js / .ts file exists
	3.	clasp push → confirm pushed files
	4.	Refresh Apps Script editor → confirm files are visible

⸻

Quick troubleshooting table

Project file already exists in an empty folder

Cause: clasp context collision / bug inside repo tree
Fix: create in /tmp and move the generated files into repo

Script is already up to date but editor is empty

Cause: only appsscript.json exists, no code files to show
Fix: create Code.gs (or your real files) and clasp push

.clasp.json is “untracked”

Cause: normal local-only metadata
Fix: ignore

Errors mentioning client_email

Cause: you gave clasp something it interpreted as service account JSON
Fix: stop; generate the correct ~/.clasprc.json schema from env vars

⸻

The canonical playbook (copy/paste)
	1.	Generate ~/.clasprc.json from env vars (no secrets in chat)
	2.	clasp status must succeed
	3.	If in-repo create fails → create in /tmp
	4.	Move .clasp.json + appsscript.json into repo folder
	5.	Add code file(s)
	6.	clasp push
	7.	Verify scriptId matches browser project

⸻

If you want, I can also turn this into a single bootstrap.sh script that:
	•	writes ~/.clasprc.json from env vars
	•	creates project in /tmp
	•	moves into a target folder
	•	adds starter Code.gs
	•	runs clasp push
	•	prints only safe status output (no secrets)