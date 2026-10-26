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
    const { query, tableExists } = dependencies;
    return Object.freeze({
      joinedMateriels() {
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
      },
      joinedPannes() {
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
    });
  }

  window.GparcDatabase = Object.freeze({ query, createDataQueries });
})();
