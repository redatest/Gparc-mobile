(() => {
  "use strict";

  function query(db, sql, params = []) {
    if (!db) throw new Error("La base SQLite n’est pas ouverte.");
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  window.GparcDatabase = Object.freeze({ query });
})();
