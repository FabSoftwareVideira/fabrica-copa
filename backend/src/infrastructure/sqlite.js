
const Database = require('better-sqlite3');

function createSqliteHelpers(db) {
    function run(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.run(...params);
    }

    function get(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.get(...params);
    }

    function all(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    }

    function transaction(fn) {
        return db.transaction(fn);
    }

    function ensureColumn(table, column, sqlDefinition) {
        const cols = all(`PRAGMA table_info(${table})`);
        const exists = cols.some((c) => c.name === column);
        if (!exists) {
            run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDefinition}`);
        }
    }

    return {
        run,
        get,
        all,
        transaction,
        ensureColumn,
        db, // expõe o db para casos avançados
    };
}

module.exports = {
    createSqliteHelpers,
    Database
};
