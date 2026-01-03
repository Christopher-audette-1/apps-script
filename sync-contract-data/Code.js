/********* CONFIG *********/
const SOURCES = [
  {
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRuIszSovfC-A8YoleWAnry89Mee0vj_j6mSXrOLROyaq7qi63kmNOZu9b03t48x6_gl97q1sq9fe9q/pub?gid=164245041&single=true&output=csv',
    sheetName: 'Deals',
  },
  {
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRuIszSovfC-A8YoleWAnry89Mee0vj_j6mSXrOLROyaq7qi63kmNOZu9b03t48x6_gl97q1sq9fe9q/pub?gid=1946214353&single=true&output=csv',
    sheetName: 'Contract Data',
  },
];
const USER_AUTH_FLAG = 'audette.sync.authorized';
/***************************/

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Data Sync')
    .addItem('Refresh Deals & Contract Values', 'refreshData')
    .addSeparator()
    .addItem('Authorize…', 'showAuthSidebar_')
    .addToUi();

  // If not authorized yet, show the sidebar and don't run.
  if (!isAuthorized_()) {
    showAuthSidebar_();
    return;
  }

  // Already authorized → run normally.
  refreshData();
}

/**
 * Sidebar UI to trigger the consent dialog (via google.script.run).
 */
function showAuthSidebar_() {
  const html = HtmlService.createHtmlOutput(`
    <div style="font:14px/1.4 Arial, sans-serif; padding:16px;">
      <h2 style="margin:0 0 8px;">Authorize Data Sync</h2>
      <p>This add-on needs permission to fetch CSVs and update this sheet.</p>
      <button id="authBtn" style="padding:8px 12px;">Authorize now</button>
      <div id="msg" style="margin-top:12px; white-space:pre-wrap;"></div>
      <script>
        const btn = document.getElementById('authBtn');
        const msg = document.getElementById('msg');
        btn.onclick = function(){
          btn.disabled = true;
          msg.textContent = 'Requesting permission…';
          google.script.run
            .withSuccessHandler(() => {
              msg.textContent = 'Authorized ✔\\nClose this panel and use the “Data Sync” menu, or reload the sheet.';
            })
            .withFailureHandler(e => {
              btn.disabled = false;
              msg.textContent = 'Authorization failed:\\n' + (e && e.message ? e.message : e);
            })
            .authorizeServer_();
        };
      </script>
    </div>
  `).setTitle('Authorize Data Sync');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from sidebar; triggers the OAuth consent if needed.
 * After success, we mark a user-level flag so onOpen can auto-run next time.
 */
function authorizeServer_() {
  // Touch the scopes we need so Apps Script asks for consent if not granted:
  //  - External fetch (UrlFetchApp)
  //  - Spreadsheet edits (SpreadsheetApp)
  // NOTE: Just getting a token is enough to trigger consent when called
  //       from an HTML dialog/sidebar (NOT from simple onOpen).
  const _ = ScriptApp.getOAuthToken();
  SpreadsheetApp.getActive(); // touches spreadsheet scope

  // Mark authorized for this user
  PropertiesService.getUserProperties().setProperty(USER_AUTH_FLAG, '1');
}

/** Helper: user-level authorized flag. */
function isAuthorized_() {
  return PropertiesService.getUserProperties().getProperty(USER_AUTH_FLAG) === '1';
}

/** Main refresh with UI dialog results. */
function refreshData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const log = [];

  SOURCES.forEach(({ url, sheetName }) => {
    try {
      const { rows, cols } = importCsvToSheet_(ss, url, sheetName);
      log.push(`✔ ${sheetName} updated (${rows}×${cols})`);
    } catch (err) {
      log.push(`✖ ${sheetName} failed:\n${(err && err.message) || err}`);
    }
  });

  ui.alert('Data Sync Results', log.join('\n\n'), ui.ButtonSet.OK);
}

function importCsvToSheet_(ss, url, sheetName) {
  const sheet = getOrCreateSheet_(ss, sheetName);
  removeBasicFilter_(sheet);

  const csvText = fetchCsvWithFallback_(url);
  const data = Utilities.parseCsv(csvText);
  const rows = data.length;
  const cols = rows ? data[0].length : 0;

  sheet.clear({ contentsOnly: true });
  sheet.clearConditionalFormatRules();

  ensureSize_(sheet, Math.max(rows, 1), Math.max(cols, 1));

  if (rows > 0 && cols > 0) {
    sheet.getRange(1, 1, rows, cols).setValues(data);
  } else {
    sheet.getRange(1, 1).setValue('');
  }
  return { rows, cols };
}

function fetchCsvWithFallback_(url) {
  let res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true });
  let code = res.getResponseCode();
  if (code === 200) return res.getContentText();

  if (code === 401 || code === 403) {
    const token = ScriptApp.getOAuthToken();
    res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
      headers: { Authorization: 'Bearer ' + token },
    });
    code = res.getResponseCode();
    if (code === 200) return res.getContentText();
  }

  throw new Error(
    `HTTP ${code} fetching ${url}.\n` +
    `• Open the link in an incognito window. If it fails, it isn’t public.\n` +
    `• Either re-publish the tab OR replace with a Drive export link:\n` +
    `  https://docs.google.com/spreadsheets/d/{FILE_ID}/export?format=csv&gid={GID}\n` +
    `  (script runner needs at least Viewer access).`
  );
}

function ensureSize_(sheet, rows, cols) {
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  if (maxRows < rows) sheet.insertRowsAfter(maxRows, rows - maxRows);
  else if (maxRows > rows) sheet.deleteRows(rows + 1, maxRows - rows);
  if (maxCols < cols) sheet.insertColumnsAfter(maxCols, cols - maxCols);
  else if (maxCols > cols) sheet.deleteColumns(cols + 1, maxCols - cols);
}

function removeBasicFilter_(sheet) {
  const f = sheet.getFilter && sheet.getFilter();
  if (f) f.remove();
}

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}