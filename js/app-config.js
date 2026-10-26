(() => {
  "use strict";
  window.GparcAppConfig = Object.freeze({
    PAGE_SIZE: 50,
    viewInfo: {
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
    },
    tableTitles: {
      materiel: "Matériel",
      panne: "Pannes et interventions",
      structures: "Structures",
      utilisateurs: "Utilisateurs",
      type_mat: "Types de matériel",
      model_mat: "Modèles",
      lieu_rep: "Lieux de réparation",
      affect_mat: "Historique des affectations",
      historique_reforme: "Historique des réformes",
      parametres_materiel: "Paramètres matériel",
      parametre_type_mat: "Paramètres par type",
      oracle_sync_history: "Historique de synchronisation Oracle",
      cara_mat: "Caractéristiques matériel"
    }
  });
})();
