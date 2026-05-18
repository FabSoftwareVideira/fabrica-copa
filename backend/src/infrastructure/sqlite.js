function createSqliteHelpers(db) {
    function run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function onRun(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });
    }

    function get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    function all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    async function ensureColumn(table, column, sqlDefinition) {
        const cols = await all(`PRAGMA table_info(${table})`);
        const exists = cols.some((c) => c.name === column);
        if (!exists) {
            await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDefinition}`);
        }
    }

    return {
        run,
        get,
        all,
        ensureColumn,
    };
}

module.exports = { createSqliteHelpers };
