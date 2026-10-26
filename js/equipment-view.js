(() => {
  "use strict";

  function createEquipmentView(dependencies) {
    const { state, $, esc, formatStatus, normalize, normalizeCode, stopScanner, startScanner, startOCR, showMainPage, renderView, joinedMateriels } = dependencies;

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
  
    return Object.freeze({ closeEquipmentModal, showEquipmentModal, returnToScan, goToMainFromModal, findScannedEquipment });
  }

  window.GparcEquipmentView = Object.freeze({ createEquipmentView });
})();
