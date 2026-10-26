(() => {
  "use strict";

  function createViewManager(dependencies) {
    const { state, $, PAGE_SIZE, viewInfo, query, columns, count, esc, tableTitles, dashboard, renderTableView } = dependencies;

    function schemaView() {
    const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    $("row-count").textContent = tables.length + " tables";
    return '<div class="schema-list">'+tables.map(item=>{
      const name=item.name, cols=columns(name), n=count(name);
      return '<article class="schema-item"><strong>'+esc(tableTitles[name] || name)+'</strong><small>'+esc(name)+' · '+n+' ligne(s)</small><small>'+cols.map(esc).join(" · ")+'</small></article>';
    }).join("")+'</div>';
  }

    function renderView(view) {
    if (!state.db) return;
    state.view = view;
    state.pageSize = PAGE_SIZE;
    document.querySelectorAll(".nav-item").forEach(button=>button.classList.toggle("active",button.dataset.view===view));
    const info=viewInfo[view]||viewInfo.dashboard;
    $("view-eyebrow").textContent=info[0];$("view-title").textContent=info[1];$("view-description").textContent=info[2];
    if (view==="dashboard") $("view-content").innerHTML=dashboard();
    else if (view==="schema") $("view-content").innerHTML=schemaView();
    else renderTableView(view);
  }

    return Object.freeze({ schemaView, renderView });
  }

  window.GparcViewManager = Object.freeze({ createViewManager });
})();
