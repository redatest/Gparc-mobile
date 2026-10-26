(() => {
  "use strict";

  function createAppInit({
    state, $, renderView, showMainPage, startScanner, startOCR, stopScanner,
    showStartScreen, findScannedEquipment, closeEquipmentModal, returnToScan,
    goToMainFromModal, importFile, restoreDatabase
  }) {
    async function init() {
      document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => renderView(button.dataset.view)));
      $("open-main").addEventListener("click", showMainPage);
      $("scan-inventory").addEventListener("click", () => startScanner("inventory"));
      $("scan-serial").addEventListener("click", () => startScanner("serial"));
      $("ocr-auto").addEventListener("click", () => startOCR("auto"));
      $("close-scan").addEventListener("click", () => {
        stopScanner();
        $("scan-panel").classList.add("hidden");
        $("scan-panel").classList.remove("manual-only");
        $("workspace").classList.add("hidden");
        $("import-panel").classList.add("hidden");
        $("start-screen").classList.remove("hidden");
      });
      $("manual-scan-value").addEventListener("input", () => $("manual-scan-value").classList.remove("scan-value-success"));
      $("manual-scan-form").addEventListener("submit", event => {
        event.preventDefault();
        findScannedEquipment($("manual-scan-value").value);
      });
      $("manual-scan-open").addEventListener("click", showStartScreen);
      $("modal-close-btn").addEventListener("click", () => { closeEquipmentModal(); showStartScreen(); });
      $("modal-scan-again-btn").addEventListener("click", returnToScan);
      $("modal-open-main-btn").addEventListener("click", goToMainFromModal);
      $("equipment-modal").addEventListener("click", event => {
        if (event.target === $("equipment-modal")) { closeEquipmentModal(); showStartScreen(); }
      });
      window.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("equipment-modal").classList.contains("hidden")) {
          closeEquipmentModal();
          showStartScreen();
        }
      });
      $("refresh-view").addEventListener("click", () => renderView(state.view));
      $("db-file").addEventListener("change", event => importFile(event.target.files?.[0]));
      $("replace-db").addEventListener("click", () => $("replacement-file").click());
      $("replacement-file").addEventListener("change", event => importFile(event.target.files?.[0]));
      if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
        navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker indisponible", error));
      }
      try {
        if (typeof initSqlJs !== "function") throw new Error("Le moteur SQLite (sql.js) n’a pas été chargé. Vérifiez la connexion internet, puis rechargez la page.");
        state.SQL = await initSqlJs({ locateFile: file => "https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/" + file });
        $("import-status").textContent = "Moteur SQLite prêt. Sélectionnez le fichier de sauvegarde.";
        await restoreDatabase();
      } catch (error) {
        $("import-status").className = "status error";
        $("import-status").textContent = error.message || String(error);
      }
      let installPrompt = null;
      window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event;
        $("install-button").classList.remove("hidden");
      });
      $("install-button").addEventListener("click", async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        $("install-button").classList.add("hidden");
      });
    }

    return Object.freeze({ init });
  }

  window.GparcAppInit = Object.freeze({ createAppInit });
})();
