(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { SQL: null, db: null, dbBytes: null, dbName: "", importedAt: "", view: "dashboard", rows: [], filtered: [], page: 1, pageSize: 50, search: "", filter: "all", scanMode: "inventory", scanStream: null, scanFrame: 0, detector: null, detecting: false, scanControls: null, codeReader: null };
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
    const stmt = state.db.prepare(sql);
    try {
      stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      return out;
    } finally { stmt.free(); }
  }
  function tableExists(name) {
    return !!query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]).length;
  }
  function columns(name) {
    if (!tableExists(name)) return [];
    return query('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').map(row => row.name);
  }
  function col(table, name, alias) {
    return columns(table).includes(name) ? (alias ? alias + "." : "") + '"' + name + '"' : "NULL";
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
    if (!tableExists("materiel")) return [];
    return query(`SELECT m.*, s.lib_str AS structure_nom, s.cod_str AS structure_code,
      t.lib_typ_mat AS type_nom, mod.model_mat AS modele_nom, mod.marque_mat AS marque_modele,
      u.nom_uti, u.pnom_uti
      FROM materiel m
      LEFT JOIN structures s ON m.id_str=s.id_str
      LEFT JOIN type_mat t ON m.id_typ_mat=t.id_typ_mat
      LEFT JOIN model_mat mod ON m.id_model_mat=mod.id_model_mat
      LEFT JOIN utilisateurs u ON m.id_uti=u.id_uti
      WHERE COALESCE(m.archiv,'N')='N' ORDER BY m.id_mat DESC`);
  }
  function joinedPannes() {
    if (!tableExists("panne")) return [];
    return query(`SELECT p.*, m.num_inv AS materiel_num_inv, m.num_ser AS materiel_num_ser,
      m.id_uti, m.etat_reforme, mod.model_mat AS modele_nom, mod.marque_mat AS marque_modele,
      t.lib_typ_mat AS type_nom, u.nom_uti, u.pnom_uti, s.lib_str AS structure_nom,
      l.nom_lieu_rep AS lieu_reparation
      FROM panne p
      LEFT JOIN materiel m ON p.id_mat=m.id_mat
      LEFT JOIN model_mat mod ON m.id_model_mat=mod.id_model_mat
      LEFT JOIN type_mat t ON m.id_typ_mat=t.id_typ_mat
      LEFT JOIN utilisateurs u ON m.id_uti=u.id_uti
      LEFT JOIN structures s ON p.id_str=s.id_str
      LEFT JOIN lieu_rep l ON p.id_lieu_rep=l.id_lieu_rep
      WHERE COALESCE(p.archiv,'N')='N' ORDER BY p.id_pan DESC`);
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
      case "historique": return [...allActive("affect_mat").map(r=>({...r, rubrique:"Affectation", date_evenement:r.dat_aff || r.dat_cre})),...allActive("historique_reforme").map(r=>({...r, rubrique:"Réforme"}))].sort((a,b)=>String(b.date_evenement||b.dat_cre||"").localeCompare(String(a.date_evenement||a.dat_cre||"")));
      default: return [];
    }
  }
  function columnsFor(view, rows) {
    const preferred = {
      parc:["num_inv","num_ser","type","marque_mat","modele","structure","utilisateur","etat_mat","statut_mat","etat_reforme","ram","disk","cpu","se","ip"],
      pannes:["dat_pan","num_inv","num_ser","diag_pan","type","modele","utilisateur","structure","technicien","lieu_reparation","eta_pan","dat_env_rep","dat_ret_rep"],
      reformes:["num_inv","num_ser","type","marque_mat","modele","structure","etat_reforme","motif_reforme","date_proposition_reforme","annee_reforme","lot_reforme","date_reforme"],
      structures:["cod_str","lib_str","structure_mere","id_str_mere","archiv"],
      utilisateurs:["nom_complet","nom_uti","pnom_uti","mail_uti","id_str_mere","archiv"],
      references:["rubrique","cod_typ_mat","lib_typ_mat","marque_mat","model_mat","nom_lieu_rep","categorie_lieu","tel_lieu_rep","adr_lieu_rep","archiv"],
      parametres:["rubrique","categorie","valeur","description","ordre","code_param","libelle_param","type_champ","unite","options_predefinies","archiv"],
      historique:["rubrique","date_evenement","dat_aff","action_aff","id_mat","id_str","id_uti","etat_reforme","ancien_etat_reforme","motif_reforme","obs_aff","archiv"]
    }[view] || [];
    const available = new Set(rows.flatMap(row => Object.keys(row)));
    const chosen = preferred.filter(key => available.has(key));
    const known = new Set(chosen);
    for (const key of rows.slice(0,20).flatMap(row => Object.keys(row))) if (!known.has(key) && chosen.length < 18 && !["image_url"].includes(key)) { chosen.push(key); known.add(key); }
    return chosen;
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
    if (!rows.length) return '<div class="empty">Aucune donnée à afficher pour cette rubrique dans la base importée.</div>';
    const head = cols.map(key=>'<th>'+esc(prettyColumn(key))+'</th>').join("");
    const body = rows.map(row=>'<tr>'+cols.map(key=>'<td>'+displayCell(key,row[key])+'</td>').join("")+'</tr>').join("");
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
  function showMainPage() {
    stopScanner();$("start-screen").classList.add("hidden");$("scan-panel").classList.add("hidden");
    if(state.db){$("import-panel").classList.add("hidden");$("workspace").classList.remove("hidden");renderView("dashboard");}
    else{$("workspace").classList.add("hidden");$("import-panel").classList.remove("hidden");$("import-status").textContent="Importez une copie SQLite pour consulter les équipements ou utiliser le scan.";}
  }
  function stopScanner() {
    if(state.scanFrame)cancelAnimationFrame(state.scanFrame);
    state.scanFrame=0;state.detecting=false;
    if(state.scanControls){try{state.scanControls.stop();}catch(error){}state.scanControls=null;}
    if(state.codeReader){try{state.codeReader.reset();}catch(error){}}
    if(state.scanStream){state.scanStream.getTracks().forEach(track=>track.stop());state.scanStream=null;}
    const video=$("scanner-video");if(video){video.pause();video.srcObject=null;}
  }
  async function startScanner(mode) {
    stopScanner();
    state.scanMode=mode;
    $("start-screen").classList.add("hidden");$("import-panel").classList.add("hidden");$("workspace").classList.add("hidden");$("scan-panel").classList.remove("hidden");
    $("scan-title").textContent=mode==="inventory"?"Scanner le numéro d’inventaire":"Scanner le numéro de série";
    $("manual-scan-value").value="";$("scan-status").className="status";
    if(!state.db){$("scan-status").textContent="Aucune base locale importée. Importez d’abord le fichier SQLite.";return;}
    if(!navigator.mediaDevices?.getUserMedia){$("scan-status").textContent="Caméra indisponible. Ouvrez l’application dans un navigateur compatible et saisissez le numéro ci-dessous.";return;}
    if(!window.ZXing?.BrowserMultiFormatReader){$("scan-status").textContent="Le moteur de scan n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page, ou saisissez le numéro manuellement.";return;}
    try {
      state.codeReader=new ZXing.BrowserMultiFormatReader();
      $("scan-status").textContent="Activation de la caméra…";
      const video=$("scanner-video");
      state.scanControls=await state.codeReader.decodeFromVideoDevice(undefined,video,(result,error,controls)=>{
        if(result){
          const value=result.getText().trim();
          if(value){
            if(controls)state.scanControls=controls;
            stopScanner();
            $("scan-status").textContent="Code lu : "+value;
            findScannedEquipment(value);
          }
        }
      });
      $("scan-status").textContent="Caméra active. Maintenez le code-barres dans le cadre quelques instants.";
    } catch(error) {
      stopScanner();
      $("scan-status").textContent=error.name==="NotAllowedError"?"Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur.":"Impossible d’activer la caméra : "+(error.message||"vérifiez les permissions.")+" Vous pouvez saisir le numéro manuellement.";
    }
  }
  function findScannedEquipment(rawValue) {
    const value=String(rawValue||"").trim();if(!value||!state.db)return;stopScanner();
    const column=state.scanMode==="inventory"?"num_inv":"num_ser";const matches=joinedMateriels().filter(row=>normalize(row[column])===normalize(value));
    $("start-status").textContent=matches.length?matches.length+" équipement(s) trouvé(s) pour « "+value+" ».":"Aucun équipement trouvé pour "+(state.scanMode==="inventory"?"le numéro d’inventaire":"le numéro de série")+" « "+value+" ». Vérifiez le mode de scan.";
    $("scan-panel").classList.add("hidden");$("start-screen").classList.remove("hidden");
    if(matches.length){showMainPage();renderView("parc");const search=$("table-search");if(search){search.value=value;search.dispatchEvent(new Event("input",{bubbles:true}));}}
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
    $("close-scan").addEventListener("click",()=>{stopScanner();$("scan-panel").classList.add("hidden");$("start-screen").classList.remove("hidden");});
    $("manual-scan-form").addEventListener("submit",event=>{event.preventDefault();findScannedEquipment($("manual-scan-value").value);});
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