(() => {
  "use strict";

  function createDashboard(dependencies) {
    const { joinedMateriels, joinedPannes, $, esc, asNum, count } = dependencies;

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
    
    return Object.freeze({ dashboard });
  }

  window.GparcDashboard = Object.freeze({ createDashboard });
})();
