(() => {
  "use strict";

  function query(db, sql, params = []) {
    if (!db) throw new Error("La base SQLite n’est pas ouverte.");
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  function createDataQueries(dependencies) {
    const { query, tableExists, allActive, safeRows } = dependencies;

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

    return Object.freeze({ joinedMateriels, joinedPannes, viewData });
  }

  window.GparcDatabase = Object.freeze({ query, createDataQueries });
})();
