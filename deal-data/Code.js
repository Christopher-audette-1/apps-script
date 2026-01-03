/*** CONFIG ***/
const SOURCE_SHEET_NAME_SALES = 'Sales Forecast';
const SOURCE_SHEET_NAME_FORECAST = 'Forecast Deals'; // outputs as "Deals-[Date]"
const SOURCE_SHEET_NAME_PBF = 'PBF Deals';
const DEALS_SHEET_NAME = 'Deals'; // User specified sheet name
const LINE_ITEMS_SHEET_NAME = 'Line Items'; // New: User specified sheet name

/*** MENU ***/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Snapshots')
    .addItem('Snapshot All (today)', 'SnapshotAll')
    .addSeparator()
    .addItem('Snapshot Sales (today)', 'SnapshotSales')
    .addItem('Snapshot Deals (today)', 'SnapshotForecast') // kept function name for trigger compatibility
    .addItem('Snapshot PBF (today)', 'SnapshotPBF')
    .addSeparator()
    .addItem('Create Weekly Deals Trigger (Mon 08:00)', 'createWeeklySnapshotTrigger')
    .addItem('Create Monthly Sales Trigger (1st 08:00)', 'createMonthlySalesTrigger')
    .addItem('Create Monthly PBF Trigger (1st 08:00)', 'createMonthlyPBFTrigger')
    .addSeparator()
    .addItem('Delete Deals Triggers', 'deleteForecastSnapshotTriggers')
    .addItem('Delete Sales Triggers', 'deleteSalesSnapshotTriggers')
    .addItem('Delete PBF Triggers', 'deletePBFSnapshotTriggers')
    .addSeparator()
    .addItem('Delete ALL Snapshot Triggers', 'deleteAllSnapshotTriggers')
    .addToUi();

  // New menu for formula copy
  SpreadsheetApp.getUi()
    .createMenu('Deal Data Formulas')
    .addItem('Copy Formulas Down (run once)', 'copyFormulasDownDealsTab')
    .addSeparator()
    .addItem('Create Daily Formula Trigger (02:00 AM)', 'createDailyDealsFormulaTrigger')
    .addItem('Delete Daily Formula Trigger', 'deleteDailyDealsFormulaTrigger')
    .addSeparator() // Added separator for new menu items
    .addItem('Copy Line Items Formulas Down (run once)', 'copyFormulasDownLineItemsTab')
    .addItem('Create Daily Line Items Formula Trigger (02:30 AM)', 'createDailyLineItemsFormulaTrigger')
    .addItem('Delete Daily Line Items Formula Trigger', 'deleteDailyLineItemsFormulaTrigger')
    .addToUi();
}

/*** PUBLIC ACTIONS ***/
// Single-shot Sales
function SnapshotSales() {
  const name = snapshotFromSource_(SOURCE_SHEET_NAME_SALES, 'Sales');
  SpreadsheetApp.getActive().toast('Sales snapshot created: ' + name, 'Snapshots', 5);
  return name;
}

// Single-shot Deals (formerly "Forecast"); keep function name for existing triggers
function SnapshotForecast() {
  const name = snapshotFromSource_(SOURCE_SHEET_NAME_FORECAST, 'Deals');
  SpreadsheetApp.getActive().toast('Deals snapshot created: ' + name, 'Snapshots', 5);
  return name;
}

// Single-shot PBF
function SnapshotPBF() {
  const name = snapshotFromSource_(SOURCE_SHEET_NAME_PBF, 'PBF');
  SpreadsheetApp.getActive().toast('PBF snapshot created: ' + name, 'Snapshots', 5);
  return name;
}

// Bundled: Sales, Deals, PBF together (shared date, contiguous tabs)
function SnapshotAll() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Vancouver';
  const dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  // Ensure sources exist
  const salesSrc = assertSheet_(SOURCE_SHEET_NAME_SALES);
  const dealsSrc = assertSheet_(SOURCE_SHEET_NAME_FORECAST);
  const pbfSrc   = assertSheet_(SOURCE_SHEET_NAME_PBF);

  // Build base names
  const salesBase = 'Sales-' + dateStr;
  const dealsBase = 'Deals-' + dateStr;
  const pbfBase   = 'PBF-'   + dateStr;

  // Pick a single suffix that avoids conflicts across all three names
  const suffix = computeSharedSuffix_(ss, [salesBase, dealsBase, pbfBase]); // '', '-2', '-3', ...

  const salesName = salesBase + suffix;
  const dealsName = dealsBase + suffix;
  const pbfName   = pbfBase   + suffix;

  // Copy + flatten
  const snapSales = copyFlattenSetColor_(salesSrc, salesName);
  const snapDeals = copyFlattenSetColor_(dealsSrc, dealsName);
  const snapPBF   = copyFlattenSetColor_(pbfSrc,   pbfName);

  // Place them adjacent, right after the right-most source tab
  const anchor = Math.max(salesSrc.getIndex(), dealsSrc.getIndex(), pbfSrc.getIndex());

  // 1) Sales right after anchor
  ss.setActiveSheet(snapSales);
  ss.moveActiveSheet(anchor + 1);
  const salesIndex = snapSales.getIndex();

  // 2) Deals immediately after Sales
  ss.setActiveSheet(snapDeals);
  ss.moveActiveSheet(salesIndex + 1);
  const dealsIndex = snapDeals.getIndex();

  // 3) PBF immediately after Deals
  ss.setActiveSheet(snapPBF);
  ss.moveActiveSheet(dealsIndex + 1);

  SpreadsheetApp.getActive().toast(
    'Bundle created: ' + [salesName, dealsName, pbfName].join(', '),
    'Snapshots',
    7
  );
  return { salesName: salesName, dealsName: dealsName, pbfName: pbfName };
}

// Function to copy formulas down in the "Deals" tab
function copyFormulasDownDealsTab() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(DEALS_SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Sheet "' + DEALS_SHEET_NAME + '" not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { // No data or only header row
    SpreadsheetApp.getActive().toast('No data rows to copy formulas to.', 'Formula Copy', 3);
    return;
  }

  // Columns Y, Z, AA, AB
  const targetColumns = [25, 26, 27, 28]; // Y, Z, AA, AB

  try {
    targetColumns.forEach(function(colIndex) {
      const sourceCell = sheet.getRange(2, colIndex); // Row 2
      const formula = sourceCell.getFormula();

      if (formula) {
        // Apply formula to the range from row 2 down to the last row
        // Using getRange(2, colIndex, lastRow - 1) means from row 2 to lastRow
        // If lastRow is 2, then lastRow - 1 is 1, so it targets only row 2.
        // If lastRow is 10, then lastRow - 1 is 9, so it targets 9 rows starting from row 2.
        sheet.getRange(2, colIndex, lastRow - 1).setFormula(formula);
      }
    });
    SpreadsheetApp.getActive().toast(
      'Formulas copied down in "' + DEALS_SHEET_NAME + '" tab.',
      'Formula Copy',
      5
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error copying formulas:', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// NEW: Function to copy formulas down in the "Line Items" tab
function copyFormulasDownLineItemsTab() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(LINE_ITEMS_SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Sheet "' + LINE_ITEMS_SHEET_NAME + '" not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { // No data or only header row
    SpreadsheetApp.getActive().toast('No data rows to copy formulas to.', 'Line Items Formula Copy', 3);
    return;
  }

  // Columns B, C, D
  const targetColumns = [2, 3, 4]; // B, C, D

  try {
    targetColumns.forEach(function(colIndex) {
      const sourceCell = sheet.getRange(2, colIndex); // Row 2
      const formula = sourceCell.getFormula();

      if (formula) {
        // Apply formula to the range from row 2 down to the last row
        sheet.getRange(2, colIndex, lastRow - 1).setFormula(formula);
      }
    });
    SpreadsheetApp.getActive().toast(
      'Formulas copied down in "' + LINE_ITEMS_SHEET_NAME + '" tab.',
      'Line Items Formula Copy',
      5
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error copying formulas:', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


/*** CORE IMPLEMENTATION (shared) ***/
function snapshotFromSource_(sourceSheetName, prefix) {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Vancouver';
  const dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const source = assertSheet_(sourceSheetName);
  const sourceIndex = source.getIndex(); // 1-based

  // Build name with prefix/date and unique suffix if needed
  var base = prefix + '-' + dateStr;
  var name = base;
  var i = 2; // first duplicate becomes "-2"
  while (ss.getSheetByName(name)) name = base + '-' + (i++);

  const snap = copyFlattenSetColor_(source, name);

  // Place snapshot immediately AFTER the source sheet
  ss.setActiveSheet(snap);
  ss.moveActiveSheet(sourceIndex + 1);

  return name;
}

function copyFlattenSetColor_(sourceSheet, newName) {
  const ss = SpreadsheetApp.getActive();
  const snap = sourceSheet.copyTo(ss).setName(newName);

  // Tab color gray
  snap.setTabColor('#9e9e9e');

  // Remove ALL filters BEFORE flattening
  clearAllFilters_(snap);

  // Flatten (values only)
  const rng = snap.getDataRange();
  rng.copyTo(rng, { contentsOnly: true });

  return snap;
}

function computeSharedSuffix_(ss, baseNames) {
  var conflict = baseNames.some(function(n) { return ss.getSheetByName(n) !== null; });
  if (!conflict) return '';
  var n = 2;
  while (true) {
    var suf = '-' + n;
    var exists = baseNames.some(function(b) { return ss.getSheetByName(b + suf) !== null; });
    if (!exists) return suf;
    n++;
  }
}

function assertSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  const s = ss.getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" not found.');
  return s;
}

/*** FILTER CLEANUP ***/
function clearAllFilters_(sheet) {
  const filt = (typeof sheet.getFilter === 'function') ? sheet.getFilter() : null;
  if (filt) filt.remove();

  try {
    if (typeof Sheets !== 'undefined' &&
        Sheets.Spreadsheets &&
        typeof Sheets.Spreadsheets.get === 'function') {

      const ssId = sheet.getParent().getId();
      const sheetId = sheet.getSheetId();

      const meta = Sheets.Spreadsheets.get(ssId, {
        fields: 'sheets(properties(sheetId),filterViews)'
      });

      const views = (meta.sheets || [])
        .filter(function(s) { return s.properties && s.properties.sheetId === sheetId; })
        .reduce(function(acc, s) {
          return acc.concat(s.filterViews || []);
        }, []);

      if (views.length) {
        const requests = views.map(function(v) {
          return { deleteFilterView: { filterId: v.filterViewId } };
        });
        Sheets.Spreadsheets.batchUpdate({ requests: requests }, ssId);
      }
    }
  } catch (e) {}
}

/*** TRIGGERS ***/
function createWeeklySnapshotTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotForecast'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('SnapshotForecast')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  SpreadsheetApp.getActive().toast('Weekly Deals trigger: Mondays at 08:00', 'Snapshots', 5);
}

function createMonthlySalesTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotSales'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('SnapshotSales')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getActive().toast('Monthly Sales trigger: 1st at 08:00', 'Snapshots', 5);
}

function createMonthlyPBFTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotPBF'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('SnapshotPBF')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getActive().toast('Monthly PBF trigger: 1st at 08:00', 'Snapshots', 5);
}

// Function to create a daily trigger for copyFormulasDownDealsTab()
function createDailyDealsFormulaTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'copyFormulasDownDealsTab'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Trigger to run every day between 2 AM and 3 AM
  ScriptApp.newTrigger('copyFormulasDownDealsTab')
    .timeBased()
    .everyDays(1)
    .atHour(2) // 2 AM
    .create();

  SpreadsheetApp.getActive().toast(
    'Daily formula copy trigger for "' + DEALS_SHEET_NAME + '" created (02:00 AM).',
    'Formula Copy',
    5
  );
}

// Function to delete the daily trigger for copyFormulasDownDealsTab()
function deleteDailyDealsFormulaTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'copyFormulasDownDealsTab'; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast(
    'Deleted ' + triggers.length + ' daily formula copy trigger(s) for "' + DEALS_SHEET_NAME + '".',
    'Formula Copy',
    5
  );
}

// NEW: Function to create a daily trigger for copyFormulasDownLineItemsTab()
function createDailyLineItemsFormulaTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'copyFormulasDownLineItemsTab'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // Trigger to run every day between 2:30 AM and 3:30 AM
  ScriptApp.newTrigger('copyFormulasDownLineItemsTab')
    .timeBased()
    .atHour(2) // 2 AM
    .atMinute(30) // 2:30 AM
    .everyDays(1)
    .create();

  SpreadsheetApp.getActive().toast(
    'Daily formula copy trigger for "' + LINE_ITEMS_SHEET_NAME + '" created (02:30 AM).',
    'Line Items Formula Copy',
    5
  );
}

// NEW: Function to delete the daily trigger for copyFormulasDownLineItemsTab()
function deleteDailyLineItemsFormulaTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'copyFormulasDownLineItemsTab'; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast(
    'Deleted ' + triggers.length + ' daily formula copy trigger(s) for "' + LINE_ITEMS_SHEET_NAME + '".',
    'Line Items Formula Copy',
    5
  );
}


/*** TRIGGER CLEANUP ***/
function deleteForecastSnapshotTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotForecast'; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast('Deleted ' + triggers.length + ' Deals trigger(s).', 'Snapshots', 5);
}

function deleteSalesSnapshotTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotSales'; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast('Deleted ' + triggers.length + ' Sales trigger(s).', 'Snapshots', 5);
}

function deletePBFSnapshotTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'SnapshotPBF'; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast('Deleted ' + triggers.length + ' PBF trigger(s).', 'Snapshots', 5);
}

function deleteAllSnapshotTriggers() {
  const handlers = { SnapshotForecast: true, SnapshotPBF: true, SnapshotSales: true, copyFormulasDownDealsTab: true, copyFormulasDownLineItemsTab: true }; // UPDATED
  const triggers = ScriptApp.getProjectTriggers()
    .filter(function(t) { return handlers[t.getHandlerFunction()]; });
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast('Deleted ' + triggers.length + ' snapshot trigger(s).', 'Snapshots', 5);
}
