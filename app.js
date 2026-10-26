(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { lastScanMethod: "barcode", lastFoundEquipment: null, SQL: null, db: null, dbBytes: null, dbName: "", importedAt: "", view: "dashboard", rows: [], filtered: [], page: 1, pageSize: 50, search: "", filter: "all", scanMode: "inventory", scanReturnTo: "start", scanStream: null, scanFrame: 0, detector: null, detecting: false, scanControls: null, codeReader: null, ocrWorker: null, ocrBusy: false, ocrTimer: 0, ocrLastCandidate: "", ocrCandidateCount: 0 };
  const { PAGE_SIZE, viewInfo, tableTitles } = window.GparcAppConfig;
  const { esc, normalize, asNum, formatDate, formatStatus, isIdColumn, prettyColumn } = window.GparcFormatters;
  function query(sql, params = []) {
    return window.GparcDatabase.query(state.db, sql, params);
  }
  const dataQueries = window.GparcDatabase.createDataQueries({ query, tableExists, allActive, safeRows });
  const tableRenderer = window.GparcTableRenderer.createTableRenderer({ isIdColumn, esc, formatStatus, formatDate, prettyColumn });
  function tableExists(name) {
    return !!query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]).length;
  }
  function columns(name) {
    if (!tableExists(name)) return [];
    return query('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').map(row => row.name);
  }
  function safeRows(table, limit = 10000) {
    if (!tableExists(table)) return [];
    return query('SELECT * FROM "' + table.replace(/"/g, '""') + '" LIMIT ' + Math.max(1, Math.min(limit, 20000)));
  }
  function count(table, where = "") {
    if (!tableExists(table)) return 0;
    return asNum(query('SELECT COUNT(*) AS n FROM "' + table + '"' + where)[0]?.n);
  }
  function allActive(table, alias = "") {
    if (!tableExists(table)) return [];
    const c = columns(table);
    const where = c.includes("archiv") ? " WHERE " + (alias ? alias + "." : "") + "archiv = 'N'" : "";
    return safeRows(table).filter(row => !("archiv" in row) || normalize(row.archiv) !== "o");
  }
  const dashboardView = window.GparcDashboard.createDashboard({
    joinedMateriels, joinedPannes, $, esc, asNum, count
  });
  function dashboard() { return dashboardView.dashboard(); }

  function joinedMateriels() {
    return dataQueries.joinedMateriels();
  }
  function joinedPannes() {
    return dataQueries.joinedPannes();
  }
  function viewData(view) {
    return dataQueries.viewData(view);
  }
  function columnsFor(view, rows) {
    return tableRenderer.columnsFor(view, rows);
  }
  function displayCell(key, value) {
    return tableRenderer.displayCell(key, value);
  }
  function buildTable(rows, cols) {
    return tableRenderer.buildTable(rows, cols);
  }
  const tableViews = window.GparcFilters.createTableViews({
    state, $, viewData, columnsFor, buildTable, normalize, pageSize: PAGE_SIZE
  });
  function renderTableView(view) { tableViews.renderTableView(view); }
  function updateTableResults(view) { tableViews.updateTableResults(view); }

  const viewManager = window.GparcViewManager.createViewManager({
    state, $, PAGE_SIZE, viewInfo, query, columns, count, esc, tableTitles, dashboard, renderTableView
  });
  function schemaView() { return viewManager.schemaView(); }
  function renderView(view) { return viewManager.renderView(view); }
  const appShell = window.GparcAppShell.createAppShell({ state, $, renderView });
  function openDatabase(bytes, name, importedAt) { return appShell.openDatabase(bytes, name, importedAt); }
  function showStartScreen() { return appShell.showStartScreen(); }
  function showMainPage() { return appShell.showMainPage(); }
  function stopScanner() { return appShell.stopScanner(); }
  const scanner = window.GparcScanner.createScanner({ state, $, joinedMateriels, stopScanner, showScannedValue });
  function prepareBarcodeLookup(mode) { return scanner.prepareBarcodeLookup(mode); }
  function acceptBarcodeCandidate(rawValue) { return scanner.acceptBarcodeCandidate(rawValue); }
  function startScanner(mode) { return scanner.startScanner(mode); }
  function startOCR(mode) { return scanner.startOCR(mode); }
  function normalizeCode(value) { return scanner.normalizeCode(value); }
  function showScannedValue(rawValue, foundInDatabase = true) {
    const value = String(rawValue || "").trim();
    if (!value) return;
    stopScanner();
    const field = $("manual-scan-value");
    field.value = value;
    field.classList.add("scan-value-success");
    $("scan-status").className = foundInDatabase ? "status scan-result-success" : "status scan-result-error";
    $("scan-status").textContent = foundInDatabase
      ? "Lecture réussie : « " + value + " ». Le numéro est prêt dans le champ vert ; appuyez sur « Rechercher » pour afficher l’équipement."
      : "Numéro lu : « " + value + " », mais aucun équipement correspondant n’a été confirmé dans la base. Vérifiez le numéro dans le champ vert, puis appuyez sur « Rechercher » pour lancer la recherche.";
    field.focus();
  }
  const equipmentView = window.GparcEquipmentView.createEquipmentView({
    state, $, esc, formatStatus, normalize, normalizeCode, stopScanner, startScanner, startOCR, showMainPage, renderView, joinedMateriels
  });
  function closeEquipmentModal() { return equipmentView.closeEquipmentModal(); }
  function showEquipmentModal(row) { return equipmentView.showEquipmentModal(row); }
  function returnToScan() { return equipmentView.returnToScan(); }
  function goToMainFromModal() { return equipmentView.goToMainFromModal(); }
  function findScannedEquipment(rawValue) { return equipmentView.findScannedEquipment(rawValue); }
  const localDatabase = window.GparcLocalDatabase.createLocalDatabase({ state, $, openDatabase });
  function saveDatabase(bytes, name, importedAt) { return localDatabase.saveDatabase(bytes, name, importedAt); }
  function restoreDatabase() { return localDatabase.restoreDatabase(); }
  function importFile(file) { return localDatabase.importFile(file); }
  const appInit = window.GparcAppInit.createAppInit({
    state, $, renderView, showMainPage, startScanner, startOCR, stopScanner,
    showStartScreen, findScannedEquipment, closeEquipmentModal, returnToScan,
    goToMainFromModal, importFile, restoreDatabase
  });
  document.addEventListener("DOMContentLoaded", () => appInit.init());
})();