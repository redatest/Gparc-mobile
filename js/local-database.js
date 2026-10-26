(() => {
  "use strict";

  function createLocalDatabase({ state, $, openDatabase }) {
    function openStore() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("gparc-mobile-local", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("database");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function saveDatabase(bytes, name, importedAt) {
      const store = await openStore();
      try {
        await new Promise((resolve, reject) => {
          const tx = store.transaction("database", "readwrite");
          tx.objectStore("database").put({ bytes, name, importedAt }, "active");
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        store.close();
      }
    }

    async function restoreDatabase() {
      try {
        const store = await openStore();
        let saved;
        try {
          saved = await new Promise((resolve, reject) => {
            const tx = store.transaction("database", "readonly");
            const request = tx.objectStore("database").get("active");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        } finally {
          store.close();
        }
        if (saved?.bytes) openDatabase(saved.bytes, saved.name, saved.importedAt);
      } catch (error) {
        console.warn("Restauration locale indisponible", error);
      }
    }

    async function importFile(file) {
      if (!file) return;
      const status = $("import-status");
      status.className = "status";
      status.textContent = "Lecture et vérification du fichier…";
      try {
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength < 100) throw new Error("Le fichier semble vide ou trop petit pour être une base SQLite.");
        if (!state.SQL) throw new Error("Le moteur SQLite n’est pas chargé. Connectez-vous une première fois puis réessayez.");
        const importedAt = new Date().toISOString();
        const test = new state.SQL.Database(new Uint8Array(bytes));
        try {
          const check = test.exec("PRAGMA quick_check");
          if (!check.length || check[0].values[0][0] !== "ok") throw new Error("La base SQLite n’a pas passé le contrôle d’intégrité.");
          if (!queryTables(test).length) throw new Error("Aucune table SQLite n’a été trouvée dans ce fichier.");
        } finally {
          test.close();
        }
        await saveDatabase(bytes, file.name, importedAt);
        openDatabase(bytes, file.name, importedAt);
        status.className = "status success";
        status.textContent = "Base importée et vérifiée.";
      } catch (error) {
        status.className = "status error";
        status.textContent = "Import impossible : " + (error.message || String(error));
      }
    }

    function queryTables(db) {
      const statement = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      const rows = [];
      try {
        while (statement.step()) rows.push(statement.getAsObject());
      } finally {
        statement.free();
      }
      return rows;
    }

    return Object.freeze({ saveDatabase, restoreDatabase, importFile });
  }

  window.GparcLocalDatabase = Object.freeze({ createLocalDatabase });
})();
