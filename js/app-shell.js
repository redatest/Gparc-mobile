(() => {
  "use strict";

  function createAppShell(dependencies) {
    const { state, $, renderView } = dependencies;

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
      function showStartScreen() {
      stopScanner();
      $("scan-panel").classList.add("hidden");
      $("scan-panel").classList.remove("manual-only");
      $("workspace").classList.add("hidden");
      $("import-panel").classList.add("hidden");
      $("start-screen").classList.remove("hidden");
    }
      function showMainPage() {
      stopScanner();$("start-screen").classList.add("hidden");$("scan-panel").classList.add("hidden");
      if(state.db){$("import-panel").classList.add("hidden");$("workspace").classList.remove("hidden");renderView("dashboard");}
      else{$("workspace").classList.add("hidden");$("import-panel").classList.remove("hidden");$("import-status").textContent="Importez une copie SQLite pour consulter les équipements ou utiliser le scan.";}
    }
      function stopScanner() {
      if(state.scanFrame)cancelAnimationFrame(state.scanFrame);
      if(state.ocrTimer)clearTimeout(state.ocrTimer);
      state.ocrTimer=0;state.ocrBusy=false;state.scanFrame=0;state.detecting=false;state.detector=null;
      if(state.scanControls){try{state.scanControls.stop();}catch(error){}state.scanControls=null;}
      if(state.codeReader){try{state.codeReader.reset();}catch(error){}}
      if(state.scanStream){state.scanStream.getTracks().forEach(track=>track.stop());state.scanStream=null;}
      const video=$("scanner-video");if(video){video.pause();video.srcObject=null;}
    }
  
    return Object.freeze({ openDatabase, showStartScreen, showMainPage, stopScanner });
  }

  window.GparcAppShell = Object.freeze({ createAppShell });
})();
