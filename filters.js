(() => {
  "use strict";

  function createTableViews(dependencies) {
    const { state, $, viewData, columnsFor, buildTable, normalize, pageSize } = dependencies;

      function renderTableView(view) {
        state.rows = viewData(view);
        state.search = "";
        state.filter = "all";
        state.page = 1;
        const filters = view === "pannes" ? [
          ["all","Tous les statuts"],["EP","En panne"],["ER","En réparation"],["RP","Réparé"],["IR","Irréparable"]
        ] : view === "parc" ? [
          ["all","Tous les états"],["BON","Bon état"],["PANNE","En panne"],["IRREPARABLE","Irréparable"]
        ] : view === "reformes" ? [
          ["all","Toutes les réformes"],["PROPOSEE","Proposé à la réforme"],["REFORME","Réformé"]
        ] : [];
        const filterMarkup = filters.length ? '<select id="status-filter" class="filter-select" aria-label="Filtrer par statut">'+filters.map(f=>'<option value="'+f[0]+'">'+f[1]+'</option>').join("")+'</select>' : "";
        $("view-content").innerHTML = '<div class="toolbar"><input id="table-search" class="search" type="search" placeholder="Rechercher dans les résultats…" aria-label="Rechercher dans les résultats">'+filterMarkup+'<select id="page-size" class="filter-select" aria-label="Lignes par page"><option value="25">25 lignes</option><option value="50" selected>50 lignes</option><option value="100">100 lignes</option></select></div><div id="table-results"></div>';
        $("table-search").addEventListener("input", event => { state.search = normalize(event.target.value); state.page = 1; updateTableResults(view); });
        const filterEl = $("status-filter");
        if (filterEl) filterEl.addEventListener("change", event => {state.filter=event.target.value;state.page=1;updateTableResults(view);});
        $("page-size").addEventListener("change", event => {state.pageSize=Number(event.target.value)||PAGE_SIZE;state.page=1;updateTableResults(view);});
        updateTableResults(view);
      }
      function updateTableResults(view) {
        let rows = state.rows;
        if (state.search) rows = rows.filter(row => Object.values(row).some(value => normalize(value).includes(state.search)));
        if (state.filter !== "all") {
          if (view === "pannes") rows = rows.filter(row=>String(row.eta_pan||"").toUpperCase()===state.filter);
          if (view === "parc") rows = rows.filter(row=>String(row.etat_mat||"").toUpperCase()===state.filter);
          if (view === "reformes") rows = rows.filter(row=>String(row.etat_reforme||"").toUpperCase()===state.filter || (state.filter==="REFORME" && String(row.statut_mat||"").toUpperCase()==="RF"));
        }
        const cols = columnsFor(view, rows.length ? rows : state.rows);
        const pages = Math.max(1,Math.ceil(rows.length/state.pageSize));
        state.page = Math.min(state.page,pages);
        const slice = rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
        $("table-results").innerHTML = buildTable(slice,cols) + '<div class="pagination"><span>'+rows.length+' résultat(s) · Page '+state.page+' / '+pages+'</span><div><button id="prev-page" '+(state.page<=1?'disabled':'')+'>Précédent</button> <button id="next-page" '+(state.page>=pages?'disabled':'')+'>Suivant</button></div></div>';
        $("row-count").textContent = rows.length + " résultat(s)";
        $("prev-page").addEventListener("click",()=>{state.page--;updateTableResults(view);});
        $("next-page").addEventListener("click",()=>{state.page++;updateTableResults(view);});
      }
    
    return Object.freeze({ renderTableView, updateTableResults });
  }

  window.GparcFilters = Object.freeze({ createTableViews });
})();
