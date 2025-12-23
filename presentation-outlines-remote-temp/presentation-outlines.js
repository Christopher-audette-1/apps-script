function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('Presentation Outlines')
    .addItem('Select company', 'showCompanySelector')
    .addItem('Setup named ranges', 'setupNamedRanges')
    .addItem('Configure Secret Manager', 'showSecretManagerConfig')
    .addToUi();

  PresentationOutlinesLib.onOpen(e);
}

function showCompanySelector() {
  PresentationOutlinesLib.showCompanySelector();
}

function getCompaniesForDropdown() {
  return PresentationOutlinesLib.getCompaniesForDropdown();
}

function applyCompanySelection(companyId) {
  return PresentationOutlinesLib.applyCompanySelection(companyId);
}

function setupNamedRanges() {
  PresentationOutlinesLib.setupNamedRanges();
}

function showSecretManagerConfig() {
  PresentationOutlinesLib.showSecretManagerConfigDialog();
}
