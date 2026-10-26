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
  const dataQueries = window.GparcDatabase.createDataQueries({ query, tableExists });
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
  function renderMetrics(items) {
    return '<div class="metrics">' + items.map(item => '<article class="metric"><div class="label">' + esc(item.label) + '</div><div class="value">' + esc(item.value) + '</div><div class="hint">' + esc(item.hint || "Dans la base importée") + '</div></article>').join("") + '</div>';
  }
  function distribution(title, items, labelKey, valueKey) {
    if (!items.length) return '<section class="panel"><h2>' + esc(title) + '</h2><p class="muted">Aucune donnée disponible.</p></section>';
    const max = Math.max(1, ...items.map(item => asNum(item[valueKey])));
    return '<section class="panel"><h2>' + esc(title) + '</h2>' + items.slice(0, 10).map(item => '<div class="bar-row"><span>' + esc(item[labelKey] || "Non renseigné") + '</span><div class="bar-track"><div class="bar-fill" style="width:' + Math.max(0, Math.min(100, asNum(item[valueKey]) / max * 100)) + '%"></div></div><span class="bar-value">' + asNum(item[valueKey]) + '</span></div>').join("") + '</section>';
  }
  function dashboard() {
    const materiels = joinedMateriels();
    const pannes = joinedPannes();
    const livePannes = pannes.filter(row => ["EP", "ER", "EC", "AT"].includes(String(row.eta_pan || "").toUpperCase()));
    const repairs = pannes.filter(row => ["ER", "AT"].includes(String(row.eta_pan || "").toUpperCase()));
    const repaired = pannes.filter(row => ["RP", "IR"].includes(String(row.eta_pan || "").toUpperCase()));
    const reformes = materiels.filter(row => ["RF", "REFORME"].includes(String(row.statut_mat || "").toUpperCase()) || String(row.etat_reforme || "").toUpperCase() === "REFORME");
    const operational = materiels.filter(row => ["BON", "OP"].includes(String(row.etat_mat || "").toUpperCase()));
    const types = materiels.reduce((acc, row) => { const k = row.type_nom || row.lib_typ_mat || row.id_typ_mat || "Non renseigné"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const structures = materiels.reduce((acc, row) => { const k = row.structure_nom || row.id_str || "Non renseignée"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const typeRows = Object.entries(types).map(([type, n]) => ({type, n})).sort((a,b)=>b.n-a.n);
    const structRows = Object.entries(structures).map(([structure, n]) => ({structure, n})).sort((a,b)=>b.n-a.n);
    $("row-count").textContent = materiels.length + " équipements";
    return renderMetrics([
      {label:"Équipements actifs",value:materiels.length,hint:"Matériels non archivés"},
      {label:"Opérationnels",value:operational.length,hint:"État BON ou OP"},
      {label:"Pannes actives",value:livePannes.length,hint:"En panne ou en traitement"},
      {label:"En réparation",value:repairs.length,hint:"Incidents en cours"},
      {label:"Incidents résolus",value:repaired.length,hint:"Réparés ou irréparables"},
      {label:"Équipements réformés",value:reformes.length,hint:"Statut de réforme"},
      {label:"Structures",value:count("structures"," WHERE COALESCE(archiv,'N')='N'"),hint:"Structures actives"},
      {label:"Utilisateurs",value:count("utilisateurs"," WHERE COALESCE(archiv,'N')='N'"),hint:"Utilisateurs actifs"}
    ]) + '<div class="columns">' + distribution("Répartition par type",typeRows,"type","n") + distribution("Répartition par structure",structRows,"structure","n") + '</div>' +
      '<section class="panel" style="margin-top:14px"><h2>À propos de cette copie</h2><p class="muted">La vue d’ensemble est calculée localement depuis le fichier importé. Les chiffres reflètent l’instantané de la base, pas les éventuelles modifications postérieures effectuées sur le PC Gparc.</p></section>';
  }
  function joinedMateriels() {
    return dataQueries.joinedMateriels();
  }
  function joinedPannes() {
    return dataQueries.joinedPannes();
  }
  function viewData(view) {
    switch(view) {
      case "parc": return joinedMateriels().map(row => ({...row, structure:row.structure_nom || row.structure_code, type:row.type_nom, modele:row.modele_nom || row.model_mat, utilisateur:[row.pnom_uti,row.nom_uti].filter(Boolean).join(" "), etat:row.etat_mat, reforme:row.etat_reforme}));
      case "pannes": return joinedPannes().map(row => ({...row, num_inv:row.materiel_num_inv || row.num_inv, num_ser:row.materiel_num_ser || row.num_ser, type:row.type_nom, modele:row.modele_nom, structure:row.structure_nom, utilisateur:[row.pnom_uti,row.nom_uti].filter(Boolean).join(" ")}));
      case "reformes": return joinedMateriels().filter(row => ["PROPOSEE","PROPOSE","REFORME","AUCUNE"].includes(String(row.etat_reforme || "").toUpperCase()) && (String(row.etat_reforme || "").toUpperCase() !== "AUCUNE" || ["RF","REFORME"].includes(String(row.statut_mat || "").toUpperCase()))).map(row => ({...row, structure:row.structure_nom, type:row.type_nom, modele:row.modele_nom || row.model_mat}));
      case "structures": return allActive("structures").map(row => ({...row, structure_mere: allActive("structures").find(s=>String(s.id_str)===String(row.id_str_mere))?.lib_str || ""}));
      case "utilisateurs": return allActive("utilisateurs").map(row => ({...row, nom_complet:[row.pnom_uti,row.nom_uti].filter(Boolean).join(" ")}));
      case "references": return [...allActive("type_mat").map(r=>({...r, rubrique:"Type de matériel"})),...allActive("model_mat").map(r=>({...r, rubrique:"Modèle"})),...allActive("lieu_rep").map(r=>({...r, rubrique:"Lieu de réparation"}))];
      case "parametres": return [...allActive("parametres_materiel").map(r=>({...r, rubrique:"Paramètre matériel"})),...allActive("parametre_type_mat").map(r=>({...r, rubrique:"Paramètre par type"}))];
      case "historique": {
        const mats = new Map(safeRows("materiel").map(m => [String(m.id_mat), m]));
        return [
          ...allActive("affect_mat").map(r => ({
            ...r,
            rubrique: "Affectation",
            date_evenement: r.dat_aff || r.dat_cre,
            num_inv: r.num_inv || mats.get(String(r.id_mat))?.num_inv || "—",
            num_ser: r.num_ser || mats.get(String(r.id_mat))?.num_ser || "—"
          })),
          ...allActive("historique_reforme").map(r => ({
            ...r,
            rubrique: "Réforme",
            num_inv: mats.get(String(r.id_mat))?.num_inv || "—",
            num_ser: mats.get(String(r.id_mat))?.num_ser || "—"
          }))
        ].sort((a,b)=>String(b.date_evenement||b.dat_cre||"").localeCompare(String(a.date_evenement||a.dat_cre||"")));
      }
      default: return [];
    }
  }
  function columnsFor(view, rows) {
    const preferred = {
      parc:["num_inv","num_ser","type","marque_mat","modele","structure","utilisateur","etat_mat","statut_mat","etat_reforme","ram","disk","cpu","se","ip"],
      pannes:["dat_pan","num_inv","num_ser","diag_pan","type","modele","utilisateur","structure","technicien","lieu_reparation","eta_pan","dat_env_rep","dat_ret_rep"],
      reformes:["num_inv","num_ser","type","marque_mat","modele","structure","etat_reforme","motif_reforme","date_proposition_reforme","annee_reforme","lot_reforme","date_reforme"],
      structures:["cod_str","lib_str","structure_mere","archiv"],
      utilisateurs:["nom_complet","nom_uti","pnom_uti","mail_uti","archiv"],
      references:["rubrique","cod_typ_mat","lib_typ_mat","marque_mat","model_mat","nom_lieu_rep","categorie_lieu","tel_lieu_rep","adr_lieu_rep","archiv"],
      parametres:["rubrique","categorie","valeur","description","ordre","code_param","libelle_param","type_champ","unite","options_predefinies","archiv"],
      historique:["rubrique","date_evenement","num_inv","num_ser","dat_aff","action_aff","etat_reforme","ancien_etat_reforme","motif_reforme","obs_aff","archiv"]
    }[view] || [];
    const available = new Set(rows.flatMap(row => Object.keys(row)));
    const chosen = preferred.filter(key => available.has(key) && !isIdColumn(key));
    const known = new Set(chosen);
    for (const key of rows.slice(0,20).flatMap(row => Object.keys(row))) {
      if (!known.has(key) && chosen.length < 18 && !["image_url"].includes(key) && !isIdColumn(key)) {
        chosen.push(key);
        known.add(key);
      }
    }
    return chosen.filter(key => !isIdColumn(key));
  }
  function displayCell(key, value) {
    if (["eta_pan","etat_mat","statut_mat","etat_reforme"].includes(key)) return formatStatus(value);
    if (value == null || value === "") return "—";
    if (/^(dat_|date_|date$)/.test(key)) return esc(formatDate(value));
    if (typeof value === "object") return esc(JSON.stringify(value));
    if (String(key).startsWith("image_")) return "—";
    return esc(value);
  }
  function buildTable(rows, cols) {
    const cleanCols = cols.filter(key => !isIdColumn(key));
    if (!rows.length) return '<div class="empty">Aucune donnée à afficher pour cette rubrique dans la base importée.</div>';
    const head = cleanCols.map(key=>'<th>'+esc(prettyColumn(key))+'</th>').join("");
    const body = rows.map(row=>'<tr>'+cleanCols.map(key=>'<td>'+displayCell(key,row[key])+'</td>').join("")+'</tr>').join("");
    return '<div class="table-wrap"><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function renderTableView(view) {
    state.rows = viewData(view);
    state.search = "";
    state.filter = "all";
    state.page = 1;
    const filters = view === "pannes" ? [
      ["all","Tous les statuts"],["EP","En panne"],["ER","En réparation"],["RP","Réparé"],["IR","Irréparable"]
    ] : view === "parc" ? [
      ["all","Tous les états"],["BON","Bon état"],["PANNE","En panne"],["IRREPARABLE","Irréparable"]
    ] : view === "reformes" ? [
      ["all","Toutes les réformes"],["PROPOSEE","Proposé à la réforme"],["REFORME","Réformé"]
    ] : [];
    const filterMarkup = filters.length ? '<select id="status-filter" class="filter-select" aria-label="Filtrer par statut">'+filters.map(f=>'<option value="'+f[0]+'">'+f[1]+'</option>').join("")+'</select>' : "";
    $("view-content").innerHTML = '<div class="toolbar"><input id="table-search" class="search" type="search" placeholder="Rechercher dans les résultats…" aria-label="Rechercher dans les résultats">'+filterMarkup+'<select id="page-size" class="filter-select" aria-label="Lignes par page"><option value="25">25 lignes</option><option value="50" selected>50 lignes</option><option value="100">100 lignes</option></select></div><div id="table-results"></div>';
    $("table-search").addEventListener("input", event => { state.search = normalize(event.target.value); state.page = 1; updateTableResults(view); });
    const filterEl = $("status-filter");
    if (filterEl) filterEl.addEventListener("change", event => {state.filter=event.target.value;state.page=1;updateTableResults(view);});
    $("page-size").addEventListener("change", event => {state.pageSize=Number(event.target.value)||PAGE_SIZE;state.page=1;updateTableResults(view);});
    updateTableResults(view);
  }
  function updateTableResults(view) {
    let rows = state.rows;
    if (state.search) rows = rows.filter(row => Object.values(row).some(value => normalize(value).includes(state.search)));
    if (state.filter !== "all") {
      if (view === "pannes") rows = rows.filter(row=>String(row.eta_pan||"").toUpperCase()===state.filter);
      if (view === "parc") rows = rows.filter(row=>String(row.etat_mat||"").toUpperCase()===state.filter);
      if (view === "reformes") rows = rows.filter(row=>String(row.etat_reforme||"").toUpperCase()===state.filter || (state.filter==="REFORME" && String(row.statut_mat||"").toUpperCase()==="RF"));
    }
    const cols = columnsFor(view, rows.length ? rows : state.rows);
    const pages = Math.max(1,Math.ceil(rows.length/state.pageSize));
    state.page = Math.min(state.page,pages);
    const slice = rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
    $("table-results").innerHTML = buildTable(slice,cols) + '<div class="pagination"><span>'+rows.length+' résultat(s) · Page '+state.page+' / '+pages+'</span><div><button id="prev-page" '+(state.page<=1?'disabled':'')+'>Précédent</button> <button id="next-page" '+(state.page>=pages?'disabled':'')+'>Suivant</button></div></div>';
    $("row-count").textContent = rows.length + " résultat(s)";
    $("prev-page").addEventListener("click",()=>{state.page--;updateTableResults(view);});
    $("next-page").addEventListener("click",()=>{state.page++;updateTableResults(view);});
  }
  function schemaView() {
    const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    $("row-count").textContent = tables.length + " tables";
    return '<div class="schema-list">'+tables.map(item=>{
      const name=item.name, cols=columns(name), n=count(name);
      return '<article class="schema-item"><strong>'+esc(tableTitles[name] || name)+'</strong><small>'+esc(name)+' · '+n+' ligne(s)</small><small>'+cols.map(esc).join(" · ")+'</small></article>';
    }).join("")+'</div>';
  }
  function renderView(view) {
    if (!state.db) return;
    state.view = view;
    state.pageSize = PAGE_SIZE;
    document.querySelectorAll(".nav-item").forEach(button=>button.classList.toggle("active",button.dataset.view===view));
    const info=viewInfo[view]||viewInfo.dashboard;
    $("view-eyebrow").textContent=info[0];$("view-title").textContent=info[1];$("view-description").textContent=info[2];
    if (view==="dashboard") $("view-content").innerHTML=dashboard();
    else if (view==="schema") $("view-content").innerHTML=schemaView();
    else renderTableView(view);
  }
  function openDatabase(bytes, name, importedAt) {
    if (!state.SQL) throw new Error("Le moteur SQLite n’est pas encore chargé. Vérifiez la connexion et réessayez.");
    const next = new state.SQL.Database(new Uint8Array(bytes));
    const integrity = next.exec("PRAGMA quick_check");
    if (!integrity.length || integrity[0].values[0][0] !== "ok") { next.close(); throw new Error("La vérification SQLite a échoué : fichier incomplet ou invalide."); }
    if (state.db) state.db.close();
    state.db = next; state.dbBytes = bytes; state.dbName=name||"gparc.db"; state.importedAt=importedAt||new Date().toISOString();
    $("db-name").textContent=state.dbName;
    $("db-meta").textContent="Importée le "+new Date(state.importedAt).toLocaleString("fr-FR")+" · Lecture seule";
    $("import-panel").classList.add("hidden");
    $("workspace").classList.add("hidden");
    $("scan-panel").classList.add("hidden");
    $("start-screen").classList.remove("hidden");
    $("start-status").textContent="Base locale prête : "+state.dbName;
  }
  function showStartScreen() {
    stopScanner();
    $("scan-panel").classList.add("hidden");
    $("scan-panel").classList.remove("manual-only");
    $("workspace").classList.add("hidden");
    $("import-panel").classList.add("hidden");
    $("start-screen").classList.remove("hidden");
  }
  function showMainPage() {
    stopScanner();$("start-screen").classList.add("hidden");$("scan-panel").classList.add("hidden");
    if(state.db){$("import-panel").classList.add("hidden");$("workspace").classList.remove("hidden");renderView("dashboard");}
    else{$("workspace").classList.add("hidden");$("import-panel").classList.remove("hidden");$("import-status").textContent="Importez une copie SQLite pour consulter les équipements ou utiliser le scan.";}
  }
  function stopScanner() {
    if(state.scanFrame)cancelAnimationFrame(state.scanFrame);
    if(state.ocrTimer)clearTimeout(state.ocrTimer);
    state.ocrTimer=0;state.ocrBusy=false;state.scanFrame=0;state.detecting=false;state.detector=null;
    if(state.scanControls){try{state.scanControls.stop();}catch(error){}state.scanControls=null;}
    if(state.codeReader){try{state.codeReader.reset();}catch(error){}}
    if(state.scanStream){state.scanStream.getTracks().forEach(track=>track.stop());state.scanStream=null;}
    const video=$("scanner-video");if(video){video.pause();video.srcObject=null;}
  }
  function prepareBarcodeLookup(mode) {
    const column = mode === "inventory" ? "num_inv" : "num_ser";
    state.barcodeLookup = joinedMateriels()
      .map(row => ({ raw: String(row[column] == null ? "" : row[column]).trim(), key: normalizeCode(row[column]) }))
      .filter(item => item.raw && item.key.length >= 4);
    state.barcodeCandidate = "";
    state.barcodeCandidateCount = 0;
    state.scanStatusCandidate = "";
  }
  function acceptBarcodeCandidate(rawValue) {
    const key = normalizeCode(rawValue);
    if (!key || key.length < 4 || !state.detecting) return false;
    const matches = (state.barcodeLookup || []).filter(item => item.key === key);
    if (matches.length !== 1) {
      state.barcodeCandidate = "";
      state.barcodeCandidateCount = 0;
      if (state.scanStatusCandidate !== key) {
        state.scanStatusCandidate = key;
        $("scan-status").textContent = matches.length > 1
          ? "Code détecté mais numéro ambigu dans la base. Stabilisez le code dans le cadre ou saisissez le numéro manuellement."
          : "Code détecté mais non reconnu dans la base pour ce mode. Ajustez le cadrage ou saisissez le numéro manuellement.";
      }
      return false;
    }
    if (state.barcodeCandidate === key) state.barcodeCandidateCount++;
    else { state.barcodeCandidate = key; state.barcodeCandidateCount = 1; }
    $("scan-status").textContent = "Code reconnu. Confirmation de la lecture " + Math.min(state.barcodeCandidateCount, 2) + "/2…";
    if (state.barcodeCandidateCount < 2) return false;
    state.detecting = false;
    stopScanner();
    showScannedValue(matches[0].raw);
    return true;
  }
  async function startScanner(mode) {
    stopScanner();
    state.lastScanMethod = "barcode";
    state.scanMode = mode;
    state.scanReturnTo = "start";
    $("scan-panel").classList.remove("manual-only");
    $("start-screen").classList.add("hidden"); $("import-panel").classList.add("hidden"); $("workspace").classList.add("hidden"); $("scan-panel").classList.remove("hidden");
    $("scan-title").textContent = mode === "inventory" ? "Scanner le numéro d’inventaire" : "Scanner le numéro de série";
    $("manual-scan-value").value = "";
    $("manual-scan-value").classList.remove("scan-value-success");
    $("scan-status").className = "status";
    if (!state.db) { $("scan-status").textContent = "Aucune base locale importée. Importez d’abord le fichier SQLite."; return; }
    if (!navigator.mediaDevices?.getUserMedia) { $("scan-status").textContent = "Caméra indisponible. Ouvrez l’application dans un navigateur compatible et saisissez le numéro ci-dessous."; return; }
    prepareBarcodeLookup(mode);
    if (!state.barcodeLookup.length) { $("scan-status").textContent = "Aucun numéro exploitable n’est disponible dans la base pour ce mode. Vous pouvez saisir le numéro manuellement."; return; }
    const video = $("scanner-video");
    video.setAttribute("autoplay", ""); video.setAttribute("playsinline", ""); video.muted = true;

    // Native BarcodeDetector first; use ZXing if native initialization fails.
    if ("BarcodeDetector" in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        const wanted = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];
        const formats = wanted.filter(format => supported.includes(format));
        if (!formats.length) throw new Error("Aucun format compatible avec BarcodeDetector.");
        const detector = new BarcodeDetector({ formats });
        state.scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        video.srcObject = state.scanStream;
        await video.play();
        state.detector = detector;
        state.detecting = true;
        $("scan-status").textContent = "Caméra active. Placez le code-barres bien net dans le cadre.";
        const detectFrame = async () => {
          if (!state.detecting || !video.srcObject) return;
          try {
            const codes = await detector.detect(video);
            for (const code of codes || []) if (acceptBarcodeCandidate(code.rawValue)) return;
          } catch (error) { console.warn("Échec ponctuel du décodage natif", error); }
          if (state.detecting) state.scanFrame = requestAnimationFrame(detectFrame);
        };
        state.scanFrame = requestAnimationFrame(detectFrame);
        return;
      } catch (nativeError) {
        console.warn("BarcodeDetector indisponible; bascule vers ZXing", nativeError);
        if (state.scanStream) state.scanStream.getTracks().forEach(track => track.stop());
        state.scanStream = null; state.detector = null; state.detecting = false;
        video.pause(); video.srcObject = null;
      }
    }
    if (!window.ZXing?.BrowserMultiFormatReader) {
      $("scan-status").textContent = "Le moteur de scan n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page, ou saisissez le numéro manuellement.";
      return;
    }
    try {
      const formats = [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.CODE_93, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.CODABAR].filter(format => format !== undefined);
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      if (formats.length) hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
      state.codeReader = new ZXing.BrowserMultiFormatReader(hints, 250);
      $("scan-status").textContent = "Activation de la caméra arrière…";
      state.detecting = true;
      state.scanControls = await state.codeReader.decodeFromVideoDevice(undefined, video, (result, error, controls) => {
        if (controls && !state.scanControls) state.scanControls = controls;
        if (result && state.detecting) acceptBarcodeCandidate(result.getText());
      });
      if (state.detecting) $("scan-status").textContent = "Caméra active. Approchez le code, gardez-le net et évitez les reflets.";
    } catch (error) {
      stopScanner();
      const message = error.name === "NotAllowedError" ? "Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur."
        : error.name === "NotFoundError" ? "Aucune caméra compatible détectée sur cet appareil."
        : "Impossible d’activer le scan : " + (error.message || "vérifiez les permissions.");
      $("scan-status").textContent = message + " Vous pouvez saisir le numéro manuellement.";
    }
  }
  async function startOCR(mode) {
    stopScanner();
    state.lastScanMethod = "ocr";
    state.scanMode = mode;
    state.scanReturnTo = "start";
    $("scan-panel").classList.remove("manual-only");
    $("start-screen").classList.add("hidden"); $("import-panel").classList.add("hidden"); $("workspace").classList.add("hidden"); $("scan-panel").classList.remove("hidden");
    $("scan-title").textContent = mode === "inventory" ? "Lire le numéro d’inventaire (OCR)" : "Lire le numéro de série (OCR)";
    $("scan-status").className = "status";
    $("scan-status").textContent = "Préparation de la caméra…";
    $("manual-scan-value").value = "";
    if (!state.db) { $("scan-status").textContent = "Importez d’abord une base SQLite."; return; }
    if (!navigator.mediaDevices?.getUserMedia) { $("scan-status").textContent = "Caméra indisponible. Saisissez le numéro manuellement."; return; }
    if (!window.Tesseract?.createWorker) { $("scan-status").textContent = "Le moteur OCR n’est pas chargé. Ouvrez l’application une fois avec Internet, puis rechargez-la."; return; }
    try {
      const video = $("scanner-video");
      video.setAttribute("autoplay", ""); video.setAttribute("playsinline", ""); video.muted = true;
      state.scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      video.srcObject = state.scanStream;
      await video.play();
      if (!state.ocrWorker) {
        $("scan-status").textContent = "Initialisation du moteur OCR (première utilisation)…";
        state.ocrWorker = await Tesseract.createWorker("eng", 1, {
          workerPath: "./vendor/tesseract.js/dist/worker.min.js",
          corePath: "./vendor/tesseract.js-core",
          langPath: "./vendor/traineddata",
          cacheMethod: "write",
          gzip: false
        });
        await state.ocrWorker.setParameters({
          tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./",
          tessedit_pageseg_mode: "7",
          preserve_interword_spaces: "0"
        });
      }
      // Le mode automatique cherche le texte lu dans les deux champs : numéro d’inventaire et numéro de série.
      const columnsToSearch = mode === "auto" ? ["num_inv", "num_ser"] : [mode === "inventory" ? "num_inv" : "num_ser"];
      const canonical = [...new Set(joinedMateriels().flatMap(row =>
        columnsToSearch.map(column => row[column]).filter(value => value != null && String(value).trim())
          .map(value => String(value).trim())
      ))].map(raw => ({ raw, key: normalizeCode(raw) })).filter(item => item.key.length >= 4);
      const exactIndex = new Map(canonical.map(item => [item.key, item.raw]));
      const levenshteinOne = (a, b) => {
        if (a === b) return true;
        if (Math.abs(a.length - b.length) > 1) return false;
        let i = 0, j = 0, edits = 0;
        while (i < a.length && j < b.length) {
          if (a[i] === b[j]) { i++; j++; continue; }
          if (++edits > 1) return false;
          if (a.length > b.length) i++;
          else if (b.length > a.length) j++;
          else { i++; j++; }
        }
        return edits + ((i < a.length || j < b.length) ? 1 : 0) <= 1;
      };
      const matchCandidate = token => {
        const key = normalizeCode(token);
        if (key.length < 4) return null;
        if (exactIndex.has(key)) return exactIndex.get(key);
        // OCR commonly confuses 0/O, 1/I and 5/S. Try these substitutions before a one-character typo.
        const variants = [key.replace(/O/g,"0").replace(/I/g,"1").replace(/S/g,"5"), key.replace(/0/g,"O").replace(/1/g,"I").replace(/5/g,"S")];
        for (const variant of variants) if (exactIndex.has(variant)) return exactIndex.get(variant);
        if (key.length < 6) return null;
        const possible = canonical.filter(item => item.key.length >= 6 && levenshteinOne(key, item.key));
        return possible.length === 1 ? possible[0].raw : null;
      };
      state.detecting = true;
      state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
      $("scan-status").textContent = "OCR actif. Placez uniquement le numéro dans le cadre et rapprochez le téléphone.";
      // Deux zones complémentaires : étiquette entière, puis texte sous le code-barres.
      // Cela évite de faire dépendre la lecture de la seule zone centrale.
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const lowerCanvas = document.createElement("canvas");
      const lowerContext = lowerCanvas.getContext("2d", { willReadFrequently: true });

      function makeOCRCrop(targetCanvas, targetContext, xRatio, yRatio, widthRatio, heightRatio, binarize) {
        const sx = Math.round(video.videoWidth * xRatio);
        const sy = Math.round(video.videoHeight * yRatio);
        const sw = Math.max(1, Math.round(video.videoWidth * widthRatio));
        const sh = Math.max(1, Math.round(video.videoHeight * heightRatio));
        const scale = Math.min(2.5, 2200 / sw);
        targetCanvas.width = Math.max(1, Math.round(sw * scale));
        targetCanvas.height = Math.max(1, Math.round(sh * scale));
        targetContext.drawImage(video, sx, sy, sw, sh, 0, 0, targetCanvas.width, targetCanvas.height);

        const frame = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
        const pixels = frame.data;
        const histogram = new Uint32Array(256);
        let minLuma = 255, maxLuma = 0, total = 0;
        for (let p = 0; p < pixels.length; p += 4) {
          const luma = Math.round(0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]);
          pixels[p] = pixels[p + 1] = pixels[p + 2] = luma;
          histogram[luma]++;
          if (luma < minLuma) minLuma = luma;
          if (luma > maxLuma) maxLuma = luma;
          total++;
        }
        if (maxLuma - minLuma < 22) return false;

        // Étirement du contraste pour le texte imprimé ou écrit au feutre.
        const contrast = 255 / Math.max(1, maxLuma - minLuma);
        for (let p = 0; p < pixels.length; p += 4) {
          const value = Math.max(0, Math.min(255, Math.round((pixels[p] - minLuma) * contrast)));
          pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
        }

        // Seuillage d'Otsu facultatif, surtout utile pour les caractères au feutre.
        if (binarize) {
          // Recalculer l'histogramme après l'étirement du contraste : les deux images
          // doivent utiliser la même échelle de luminosité.
          histogram.fill(0);
          for (let p = 0; p < pixels.length; p += 4) histogram[pixels[p]]++;
          let sum = 0;
          for (let i = 0; i < 256; i++) sum += i * histogram[i];
          let sumBackground = 0, weightBackground = 0, bestVariance = -1, threshold = 145;
          for (let i = 0; i < 256; i++) {
            weightBackground += histogram[i];
            if (!weightBackground) continue;
            const weightForeground = total - weightBackground;
            if (!weightForeground) break;
            sumBackground += i * histogram[i];
            const meanBackground = sumBackground / weightBackground;
            const meanForeground = (sum - sumBackground) / weightForeground;
            const variance = weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);
            if (variance > bestVariance) { bestVariance = variance; threshold = i; }
          }
          for (let p = 0; p < pixels.length; p += 4) {
            const value = pixels[p] < threshold ? 0 : 255;
            pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
          }
        }
        targetContext.putImageData(frame, 0, 0);
        return true;
      }

      const matchOCRText = recognizedText => {
        const text = String(recognizedText || "").toUpperCase();
        const tokens = text.match(/[A-Z0-9][A-Z0-9./-]{3,}/g) || [];
        const normalizedText = normalizeCode(text);
        let matched = canonical.find(item => normalizedText.includes(item.key))?.raw || null;
        if (!matched) matched = tokens.map(matchCandidate).find(Boolean) || null;
        if (!matched && tokens.length > 1) {
          for (let i = 0; i < tokens.length && !matched; i++) {
            let joined = "";
            for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
              joined += tokens[j];
              matched = matchCandidate(joined);
              if (matched) break;
            }
          }
        }
        return { matched, tokens };
      };

      state.detecting = true;
      state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
      $("scan-status").textContent = "OCR actif. Placez l’étiquette entière dans le cadre ; le texte sous le code-barres et le numéro au feutre seront essayés séparément.";
      const scanOCRFrame = async () => {
        if (!state.detecting || !video.srcObject) return;
        if (!state.ocrBusy && video.videoWidth && video.videoHeight) {
          state.ocrBusy = true;
          try {
            let recognizedText = "";
            let result = { matched: null, tokens: [] };

            // Passe 1 : zone large, du haut au bas de l’étiquette. Le numéro peut être écrit seul,
            // sans code-barres et à n’importe quelle hauteur dans l’image.
            if (makeOCRCrop(canvas, context, 0.03, 0.08, 0.94, 0.84, false)) {
              await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "11" });
              const first = await state.ocrWorker.recognize(canvas);
              recognizedText = String(first.data.text || "").toUpperCase();
              result = matchOCRText(recognizedText);
            }

            // Passe 2 : zone basse, où se trouve généralement le numéro imprimé sous le code-barres.
            // Seuillage noir/blanc pour renforcer les traits fins et les caractères épais.
            if (!result.matched && makeOCRCrop(lowerCanvas, lowerContext, 0.10, 0.43, 0.80, 0.29, true)) {
              await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "7" });
              const second = await state.ocrWorker.recognize(lowerCanvas);
              const secondText = String(second.data.text || "").toUpperCase();
              const secondResult = matchOCRText(secondText);
              if (secondResult.matched) result = secondResult;
              if (secondText.trim()) recognizedText = (recognizedText + " " + secondText).trim();
            }

            // Passe 3 : le numéro manuscrit seul peut être mieux reconnu comme une ligne unique.
            // On binarise la zone large puis on demande à Tesseract de lire une seule ligne.
            if (!result.matched && makeOCRCrop(canvas, context, 0.03, 0.08, 0.94, 0.84, true)) {
              await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "7" });
              const third = await state.ocrWorker.recognize(canvas);
              const thirdText = String(third.data.text || "").toUpperCase();
              const thirdResult = matchOCRText(thirdText);
              if (thirdResult.matched) result = thirdResult;
              if (thirdText.trim()) recognizedText = (recognizedText + " " + thirdText).trim();
            }

            if (result.matched) {
              const matched = result.matched;
              if (state.ocrLastCandidate === matched) state.ocrCandidateCount++;
              else { state.ocrLastCandidate = matched; state.ocrCandidateCount = 1; }
              $("scan-status").textContent = "Numéro probable : " + matched + " · confirmation " + state.ocrCandidateCount + "/2";
              if (state.ocrCandidateCount >= 2) {
                state.detecting = false;
                if (mode === "auto") {
                  const rows = joinedMateriels();
                  const invMatch = rows.some(row => normalizeCode(row.num_inv) === normalizeCode(matched));
                  state.scanMode = invMatch ? "inventory" : "serial";
                }
                showScannedValue(matched, true);
                return;
              }
            } else {
              const tokens = recognizedText.match(/[A-Z0-9][A-Z0-9./-]{3,}/g) || [];
              // Même sans correspondance dans la base, conserver la lecture OCR stable dans le champ vert.
              const readable = tokens.find(token => normalizeCode(token).length >= 4) || "";
              if (mode === "auto" && readable) {
                if (state.ocrLastCandidate === readable) state.ocrCandidateCount++;
                else { state.ocrLastCandidate = readable; state.ocrCandidateCount = 1; }
                $("scan-status").textContent = "Texte lu : « " + readable + " », vérification de la lecture " + state.ocrCandidateCount + "/2. Aucun équipement correspondant n’a encore été confirmé.";
                if (state.ocrCandidateCount >= 2) {
                  state.detecting = false;
                  state.scanMode = "auto";
                  showScannedValue(readable, false);
                  return;
                }
              } else {
                state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
                $("scan-status").textContent = tokens.length
                  ? "Texte détecté : « " + tokens.slice(0, 3).join(" ") + " », mais aucun numéro confirmé. Gardez l’étiquette entière dans le cadre."
                  : "Lecture en cours… rapprochez le téléphone, évitez les reflets et gardez l’étiquette entière dans le cadre.";
              }
            }
          } catch (ocrError) {
            console.warn("Erreur de reconnaissance OCR", ocrError);
            $("scan-status").textContent = "Lecture en cours. Gardez l’étiquette nette et bien éclairée ; essayez aussi de cadrer le numéro écrit au feutre.";
          } finally { state.ocrBusy = false; }
        }
        if (state.detecting) state.ocrTimer = window.setTimeout(scanOCRFrame, 350);
      };
      state.ocrTimer = window.setTimeout(scanOCRFrame, 100);
    } catch (error) {
      stopScanner();
      $("scan-status").textContent = "Impossible de démarrer l’OCR : " + (error.message || "vérifiez les permissions de la caméra.");
    }
  }
  function normalizeCode(value) {
    return String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
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
    function closeEquipmentModal() {
    $("equipment-modal").classList.add("hidden");
  }
  function showEquipmentModal(row) {
    if (!row) return;
    state.lastFoundEquipment = row;
    const inv = row.num_inv ? String(row.num_inv).trim() : "—";
    const ser = row.num_ser ? String(row.num_ser).trim() : "—";
    const type = row.type_nom || row.lib_typ_mat || row.id_typ_mat || "—";
    const marque = row.marque_mat || row.marque_modele || "—";
    const modele = row.modele_nom || row.model_mat || row.id_model_mat || "—";
    const utilisateur = row.nom_uti ? (row.pnom_uti ? `${row.nom_uti} ${row.pnom_uti}` : row.nom_uti) : (row.id_uti || "Non affecté");
    const structure = row.structure_nom || (row.structure_code ? `${row.structure_code} - ${row.structure_nom || ""}` : (row.id_str || "Non renseignée"));
    const etat = row.etat_mat || "—";
    const statut = row.statut_mat || "—";
    const etatReforme = row.etat_reforme || "aucune";

    $("modal-equipment-title").textContent = inv !== "—" ? `N° ${inv}` : `Série : ${ser}`;
    $("modal-equipment-body").innerHTML = `
      <div class="attr-list">
        <div class="attr-item highlight">
          <span class="attr-label">Numéro d’inventaire</span>
          <span class="attr-value strong mono">${esc(inv)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Numéro de série</span>
          <span class="attr-value mono">${esc(ser)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Type</span>
          <span class="attr-value">${esc(type)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Marque</span>
          <span class="attr-value">${esc(marque)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Modèle</span>
          <span class="attr-value">${esc(modele)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Utilisateur</span>
          <span class="attr-value">${esc(utilisateur)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">Structure</span>
          <span class="attr-value">${esc(structure)}</span>
        </div>
        <div class="attr-item">
          <span class="attr-label">État</span>
          <div class="attr-value">${formatStatus(etat)}</div>
        </div>
        <div class="attr-item">
          <span class="attr-label">Statut</span>
          <div class="attr-value">${formatStatus(statut)}</div>
        </div>
        <div class="attr-item">
          <span class="attr-label">État réforme</span>
          <div class="attr-value">${formatStatus(etatReforme)}</div>
        </div>
      </div>
      ${(row.ram || row.disk || row.cpu || row.ip || row.ordi) ? `
        <div class="attr-tech-summary">
          <span class="attr-tech-title">Caractéristiques complémentaires</span>
          <div class="attr-chips">
            ${row.ram ? `<span class="chip">RAM: ${esc(row.ram)}</span>` : ""}
            ${row.disk ? `<span class="chip">Disque: ${esc(row.disk)}</span>` : ""}
            ${row.cpu ? `<span class="chip">CPU: ${esc(row.cpu)}</span>` : ""}
            ${row.ip ? `<span class="chip">IP: ${esc(row.ip)}</span>` : ""}
            ${row.ordi ? `<span class="chip">Nom: ${esc(row.ordi)}</span>` : ""}
          </div>
        </div>
      ` : ""}
    `;
    $("equipment-modal").classList.remove("hidden");
  }
  function returnToScan() {
    closeEquipmentModal();
    if (state.lastScanMethod === "ocr") {
      startOCR(state.scanMode || "inventory");
    } else {
      startScanner(state.scanMode || "inventory");
    }
  }
  function goToMainFromModal() {
    const row = state.lastFoundEquipment;
    closeEquipmentModal();
    showMainPage();
    renderView("parc");
    const search = $("table-search");
    if (search && row) {
      search.value = row.num_inv || row.num_ser || "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function findScannedEquipment(rawValue) {
    const value=String(rawValue||"").trim();if(!value||!state.db)return;stopScanner();
    const columns=state.scanMode==="auto"?["num_inv","num_ser"]:[state.scanMode==="inventory"?"num_inv":"num_ser"];const matches=joinedMateriels().filter(row=>columns.some(column=>normalize(row[column])===normalize(value)));
    if (matches.length) {
      $("scan-panel").classList.add("hidden");
      showEquipmentModal(matches[0]);
    } else {
      const field = $("manual-scan-value");
      field.value = value;
      field.classList.add("scan-value-success");
      $("scan-status").className = "status scan-result-error";
      $("scan-status").textContent = "Numéro lu : « " + value + " », mais aucun équipement correspondant n’a été trouvé dans la base locale. Le numéro reste affiché dans le champ vert : vérifiez-le ou corrigez-le, puis relancez la recherche.";
      $("scan-panel").classList.remove("hidden");
      $("start-screen").classList.add("hidden");
      field.focus();
      field.select();
    }
  }
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