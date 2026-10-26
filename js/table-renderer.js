(() => {
  "use strict";

  function createTableRenderer(dependencies) {
    const { isIdColumn, esc, formatStatus, formatDate, prettyColumn } = dependencies;

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

    return Object.freeze({ columnsFor, displayCell, buildTable });
  }


  window.GparcTableRenderer = Object.freeze({ createTableRenderer });
})();
