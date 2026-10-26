(() => {
  "use strict";

  function createDataAccess({ state, asNum, normalize }) {
    function query(sql, params = []) {
      return window.GparcDatabase.query(state.db, sql, params);
    }

    function tableExists(name) {
      return !!query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]).length;
    }

    function columns(name) {
      if (!tableExists(name)) return [];
      return query('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').map(row => row.name);
    }

    function safeRows(table, limit = 10000) {
      if (!tableExists(table)) return [];
      return query('SELECT * FROM "' + table.replace(/"/g, '""') + '" LIMIT ' + Math.max(1, Math.min(limit, 20000)));
    }

    function count(table, where = "") {
      if (!tableExists(table)) return 0;
      return asNum(query('SELECT COUNT(*) AS n FROM "' + table + '"' + where)[0]?.n);
    }

    function allActive(table, alias = "") {
      if (!tableExists(table)) return [];
      const c = columns(table);
      const where = c.includes("archiv") ? " WHERE " + (alias ? alias + "." : "") + "archiv = 'N'" : "";
      return safeRows(table).filter(row => !("archiv" in row) || normalize(row.archiv) !== "o");
    }

    return Object.freeze({ query, tableExists, columns, safeRows, count, allActive });
  }

  window.GparcDataAccess = Object.freeze({ createDataAccess });
})();
