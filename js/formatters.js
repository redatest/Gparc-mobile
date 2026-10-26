(() => {
  "use strict";
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

  window.GparcFormatters = Object.freeze({
    esc, normalize, asNum, formatDate, formatStatus, isIdColumn, prettyColumn
  });
})();
