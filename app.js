(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { lastScanMethod: "barcode", lastFoundEquipment: null, SQL: null, db: null, dbBytes: null, dbName: "", importedAt: "", view: "dashboard", rows: [], filtered: [], page: 1, pageSize: 50, search: "", filter: "all", scanMode: "inventory", scanReturnTo: "start", scanStream: null, scanFrame: 0, detector: null, detecting: false, scanControls: null, codeReader: null, ocrWorker: null, ocrBusy: false, ocrTimer: 0, ocrLastCandidate: "", ocrCandidateCount: 0 };
  const PAGE_SIZE = 50;
  const viewInfo = {
    dashboard: ["TABLEAU DE BORD", "Vue d’ensemble", "Indicateurs calculés à partir de la copie importée."],
    parc: ["INVENTAIRE", "Parc informatique", "Équipements actifs et caractéristiques disponibles."],
    pannes: ["MAINTENANCE", "Pannes & interventions", "Incidents techniques, diagnostics et suivi de réparation."],
    reformes: ["CYCLE DE VIE", "Réformes", "Équipements proposés à la réforme ou déjà réformés."],
    structures: ["ORGANISATION", "Structures", "Structures et rattachements organisationnels."],
    utilisateurs: ["ORGANISATION", "Utilisateurs", "Utilisateurs référencés dans la copie de la base."],
    references: ["RÉFÉRENTIEL", "Types, modèles & réparation", "Types de matériels, modèles et lieux de réparation."],
    parametres: ["CONFIGURATION", "Paramètres", "Paramètres applicatifs disponibles dans la base importée."],
    historique: ["TRAÇABILITÉ", "Historiques", "Historique des affectations et événements de réforme."],
    schema: ["DIAGNOSTIC", "Schéma SQLite", "Tables, colonnes et nombre de lignes détectés dans le fichier importé."]
  };
  const tableTitles = {
    materiel: "Matériel", panne: "Pannes et interventions", structures: "Structures", utilisateurs: "Utilisateurs",
    type_mat: "Types de matériel", model_mat: "Modèles", lieu_rep: "Lieux de réparation", affect_mat: "Historique des affectations",
    historique_reforme: "Historique des réformes", parametres_materiel: "Paramètres matériel", parametre_type_mat: "Paramètres par type",
    oracle_sync_history: "Historique de synchronisation Oracle", cara_mat: "Caractéristiques matériel"
  };
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const normalize = value => String(value == null ? "" : value).trim().toLowerCase();
  const asNum = value => Number(value || 0);
  const formatDate = value => {
    if (!value) return "—";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[3] + "/" + match[2] + "/" + match[1] : String(value);
  };
  const formatStatus = value => {
    const key = normalize(value);
    const map = {
      ep:["En panne","bad"], er:["En réparation","warn"], rp:["Réparé","good"], ir:["Irréparable","bad"],
      bon:["Bon état","good"], panne:["En panne","bad"], irreparable:["Irréparable","bad"],
      es:["En service","good"], rf:["Réformé","bad"], proposee:["Proposé à la réforme","warn"],
      aucune:["Aucune réforme",""], reforme:["Réformé","bad"], op:["Opérationnel","good"],
      pa:["En panne","bad"], re:["En réparation","warn"], so:["Réformé","bad"]
    };
    const found = map[key];
    return found ? '<span class="pill ' + found[1] + '">' + esc(found[0]) + '</span>' : '<span class="pill">' + esc(value || "—") + '</span>';
  };
    const isIdColumn = key => {
    if (!key) return false;
    const k = String(key).trim().toLowerCase();
    if (k === "id" || k.startsWith("id_") || k.startsWith("ancien_id_") || k.includes("_id_") || k.endsWith("_id")) return true;
    const label = String(prettyColumn(key) || "").trim().toLowerCase();
    return label === "id" || label.startsWith("id ") || label.startsWith("id_") || label.startsWith("id-");
  };
  const prettyColumn = value => ({
    id_mat:"ID matériel", num_inv:"N° inventaire", num_ser:"N° série", id_str:"ID structure", structure_nom:"Structure",
    id_typ_mat:"ID type", type_nom:"Type", lib_typ_mat:"Type", id_model_mat:"ID modèle", model_mat:"Modèle", marque_mat:"Marque",
    dat_acq:"Date acquisition", dat_mes:"Mise en service", etat_mat:"État matériel", statut_mat:"Statut", etat_reforme:"État réforme",
    date_proposition_reforme:"Date proposition", date_validation_reforme:"Date validation", date_reforme:"Date réforme",
    annee_reforme:"Année réforme", lot_reforme:"Lot réforme", motif_reforme:"Motif réforme", ram:"RAM", disk:"Stockage",
    cpu:"Processeur", se:"Système", ip:"Adresse IP", ordi:"Nom machine", id_uti:"ID utilisateur", nom_uti:"Nom utilisateur",
    pnom_uti:"Prénom", dat_pan:"Date panne", diag_pan:"Diagnostic / panne", eta_pan:"Statut panne", dat_env_rep:"Date envoi réparation",
    dat_ret_rep:"Date retour réparation", id_lieu_rep:"ID lieu réparation", lieu_reparation:"Lieu réparation",
    technicien:"Technicien", obs_rep:"Observation / travaux", pieces_remplacees:"Pièces remplacées", recommandations:"Recommandations",
    cout_rep:"Coût réparation", tp:"Type incident", id_pan:"ID panne", dat_aff:"Date affectation", action_aff:"Action",
    ancien_id_str:"Ancienne structure", ancien_id_uti:"Ancien utilisateur", date_evenement:"Date événement", categorie:"Catégorie",
    valeur:"Valeur", lib_str:"Libellé structure", cod_str:"Code structure", nom_lieu_rep:"Lieu de réparation",
    adr_lieu_rep:"Adresse", tel_lieu_rep:"Téléphone", contact_rep:"Contact", id_param:"ID paramètre", description:"Description",
    archiv:"Archivé", dat_cre:"Date création", dat_mod:"Date modification"
  }[value] || String(value || "").replace(/_/g, " "));
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
  function openStore() {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open("gparc-mobile-local",1);
      request.onupgradeneeded=()=>request.result.createObjectStore("database");
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function saveDatabase(bytes,name,importedAt) {
    const store=await openStore();
    await new Promise((resolve,reject)=>{
      const tx=store.transaction("database","readwrite");
      tx.objectStore("database").put({bytes,name,importedAt},"active");
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    store.close();
  }
  async function restoreDatabase() {
    try {
      const store=await openStore();
      const saved=await new Promise((resolve,reject)=>{
        const tx=store.transaction("database","readonly");const req=tx.objectStore("database").get("active");
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      store.close();
      if(saved?.bytes) openDatabase(saved.bytes,saved.name,saved.importedAt);
    } catch(error) { console.warn("Restauration locale indisponible",error); }
  }
  async function importFile(file) {
    if (!file) return;
    const status=$("import-status");
    status.className="status";status.textContent="Lecture et vérification du fichier…";
    try {
      const bytes=await file.arrayBuffer();
      if(bytes.byteLength<100) throw new Error("Le fichier semble vide ou trop petit pour être une base SQLite.");
      if(!state.SQL) throw new Error("Le moteur SQLite n’est pas chargé. Connectez-vous une première fois puis réessayez.");
      const importedAt=new Date().toISOString();
      const test=new state.SQL.Database(new Uint8Array(bytes));
      try {
        const check=test.exec("PRAGMA quick_check");
        if(!check.length || check[0].values[0][0]!=="ok") throw new Error("La base SQLite n’a pas passé le contrôle d’intégrité.");
        if(!queryTables(test).length) throw new Error("Aucune table SQLite n’a été trouvée dans ce fichier.");
      } finally { test.close(); }
      await saveDatabase(bytes,file.name,importedAt);
      openDatabase(bytes,file.name,importedAt);
      status.className="status success";status.textContent="Base importée et vérifiée.";
    } catch(error) {
      status.className="status error";status.textContent="Import impossible : "+(error.message||String(error));
    }
  }
  function queryTables(db) {
    const stmt=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const rows=[];try{while(stmt.step())rows.push(stmt.getAsObject());}finally{stmt.free();}
    return rows;
  }
  async function init() {
    document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>renderView(button.dataset.view)));
    $("open-main").addEventListener("click",showMainPage);
    $("scan-inventory").addEventListener("click",()=>startScanner("inventory"));
    $("scan-serial").addEventListener("click",()=>startScanner("serial"));
    $("ocr-auto").addEventListener("click",()=>startOCR("auto"));
    $("close-scan").addEventListener("click",()=>{stopScanner();$("scan-panel").classList.add("hidden");$("scan-panel").classList.remove("manual-only");$("workspace").classList.add("hidden");$("import-panel").classList.add("hidden");$("start-screen").classList.remove("hidden");});
    $("manual-scan-value").addEventListener("input",()=>$("manual-scan-value").classList.remove("scan-value-success"));
    $("manual-scan-form").addEventListener("submit",event=>{event.preventDefault();findScannedEquipment($("manual-scan-value").value);});
    $("manual-scan-open").addEventListener("click",showStartScreen);
    $("modal-close-btn").addEventListener("click",()=>{closeEquipmentModal();showStartScreen();});
    $("modal-scan-again-btn").addEventListener("click",returnToScan);
    $("modal-open-main-btn").addEventListener("click",goToMainFromModal);
    $("equipment-modal").addEventListener("click",event=>{if(event.target===$("equipment-modal")){closeEquipmentModal();showStartScreen();}});
    window.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("equipment-modal").classList.contains("hidden")){closeEquipmentModal();showStartScreen();}});
    $("refresh-view").addEventListener("click",()=>renderView(state.view));
    $("db-file").addEventListener("change",event=>importFile(event.target.files?.[0]));
    $("replace-db").addEventListener("click",()=>$("replacement-file").click());
    $("replacement-file").addEventListener("change",event=>importFile(event.target.files?.[0]));
    if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")) navigator.serviceWorker.register("./service-worker.js").catch(error=>console.warn("Service worker indisponible",error));
    try {
      if(typeof initSqlJs!=="function") throw new Error("Le moteur SQLite (sql.js) n’a pas été chargé. Vérifiez la connexion internet, puis rechargez la page.");
      state.SQL=await initSqlJs({locateFile:file=>"https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/"+file});
      $("import-status").textContent="Moteur SQLite prêt. Sélectionnez le fichier de sauvegarde.";
      await restoreDatabase();
    } catch(error) {
      $("import-status").className="status error";$("import-status").textContent=error.message||String(error);
    }
    let installPrompt=null;
    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-button").classList.remove("hidden");});
    $("install-button").addEventListener("click",async()=>{
      if(!installPrompt)return;
      installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-button").classList.add("hidden");
    });
  }
  document.addEventListener("DOMContentLoaded",init);
})();