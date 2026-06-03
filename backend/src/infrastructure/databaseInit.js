function safeParseJson(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (_err) {
        return fallback;
    }
}

async function initDatabase({ run, get, all, ensureColumn, logInfo, totalStickers = 0, isKnownStickerId = null }) {
    await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'jogador',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'jogador'");
    await ensureColumn("users", "is_blocked", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("users", "blocked_reason", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("users", "wants_emails", "INTEGER NOT NULL DEFAULT 0");


    await run(`
    CREATE TABLE IF NOT EXISTS album_states (
      user_id INTEGER PRIMARY KEY,
      collected_json TEXT NOT NULL DEFAULT '{}',
      packs_used_date TEXT NOT NULL DEFAULT '',
      packs_used_today INTEGER NOT NULL DEFAULT 0,
      extra_packs INTEGER NOT NULL DEFAULT 0,
      trade_coins INTEGER NOT NULL DEFAULT 0,
      last_login_bonus_date TEXT NOT NULL DEFAULT '',
      used_codes_json TEXT NOT NULL DEFAULT '[]',
      trade_reroll_count INTEGER NOT NULL DEFAULT 0,
      trade_reroll_date TEXT NOT NULL DEFAULT '',
      completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    await ensureColumn("album_states", "trade_coins", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("album_states", "last_login_bonus_date", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("album_states", "trade_reroll_count", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("album_states", "trade_reroll_date", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("album_states", "completed_at", "TEXT");

    await run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS redeemed_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      packs_added INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
        CREATE TABLE IF NOT EXISTS user_coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            target_user_id INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            packs_added INTEGER NOT NULL DEFAULT 1,
            is_generic INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            redeemed_at TEXT,
            redeemed_by_user_id INTEGER,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (redeemed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    await ensureColumn("user_coupons", "is_generic", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("user_coupons", "redeemed_by_user_id", "INTEGER");

    await run(`
        CREATE TABLE IF NOT EXISTS custom_stickers (
            id TEXT PRIMARY KEY,
            num INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT '🎟️',
            team_id TEXT,
            team_name TEXT,
            team_image TEXT,
            section_name TEXT NOT NULL DEFAULT 'Especial',
            type TEXT NOT NULL DEFAULT 'custom',
            group_id TEXT,
            image TEXT,
            created_by_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS system_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            payload_json TEXT,
            created_by_user_id INTEGER,
            target_user_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await ensureColumn("system_events", "target_user_id", "INTEGER");

    await run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            request_id TEXT,
            user_id INTEGER,
            user_name_snapshot TEXT,
            user_email_snapshot TEXT,
            user_role_snapshot TEXT,
            action TEXT NOT NULL,
            http_method TEXT NOT NULL,
            route_path TEXT NOT NULL,
            original_url TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            client_ip TEXT NOT NULL,
            user_agent TEXT,
            browser_name TEXT,
            access_channel TEXT,
            target_user_id INTEGER,
            success INTEGER NOT NULL DEFAULT 1,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await ensureColumn("audit_logs", "request_id", "TEXT");
    await ensureColumn("audit_logs", "user_id", "INTEGER");
    await ensureColumn("audit_logs", "user_name_snapshot", "TEXT");
    await ensureColumn("audit_logs", "user_email_snapshot", "TEXT");
    await ensureColumn("audit_logs", "user_role_snapshot", "TEXT");
    await ensureColumn("audit_logs", "action", "TEXT NOT NULL DEFAULT 'http.read'");
    await ensureColumn("audit_logs", "http_method", "TEXT NOT NULL DEFAULT 'GET'");
    await ensureColumn("audit_logs", "route_path", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("audit_logs", "original_url", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("audit_logs", "status_code", "INTEGER NOT NULL DEFAULT 200");
    await ensureColumn("audit_logs", "client_ip", "TEXT NOT NULL DEFAULT 'unknown'");
    await ensureColumn("audit_logs", "user_agent", "TEXT");
    await ensureColumn("audit_logs", "browser_name", "TEXT");
    await ensureColumn("audit_logs", "access_channel", "TEXT");
    await ensureColumn("audit_logs", "target_user_id", "INTEGER");
    await ensureColumn("audit_logs", "success", "INTEGER NOT NULL DEFAULT 1");
    await ensureColumn("audit_logs", "metadata_json", "TEXT");

    await run("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)");
    await run("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC)");
    await run("CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id)");

    await run(`
    CREATE TABLE IF NOT EXISTS pack_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      stickers_json TEXT NOT NULL,
      new_count INTEGER NOT NULL,
      repeat_count INTEGER NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      offered_sticker_id TEXT NOT NULL,
      requested_sticker_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      offered_sticker_id TEXT NOT NULL,
      requested_sticker_id TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
        CREATE TABLE IF NOT EXISTS trade_window_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            starts_at TEXT NOT NULL,
            ends_at TEXT NOT NULL,
            created_by_user_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    try {
        const cols = await all("PRAGMA table_info(trade_window_config)");
        const hasCreatedAt = cols.some((c) => c.name === "created_at");
        const hasUpdatedAt = cols.some((c) => c.name === "updated_at");

        if (!hasCreatedAt || !hasUpdatedAt) {
            await run("DROP TABLE IF EXISTS trade_window_config");
            await run(`
                CREATE TABLE IF NOT EXISTS trade_window_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    starts_at TEXT NOT NULL,
                    ends_at TEXT NOT NULL,
                    created_by_user_id INTEGER,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `);
        }
    } catch (_err) {
        await run("DROP TABLE IF EXISTS trade_window_config");
        await run(`
            CREATE TABLE IF NOT EXISTS trade_window_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                created_by_user_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
    }

    await ensureColumn("trade_window_config", "created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn("trade_window_config", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

    await run(`
        CREATE TABLE IF NOT EXISTS db_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS album_completed_backfill_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            completed_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'timeline',
            migration_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, migration_name),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    const migrationApplied = await get(
        "SELECT name FROM db_migrations WHERE name = 'fix_trade_history_acceptor_perspective'"
    );
    if (!migrationApplied) {
        await run(`
            UPDATE trade_history
            SET offered_sticker_id = requested_sticker_id,
                requested_sticker_id = offered_sticker_id
            WHERE user_id = to_user_id
        `);
        await run(
            "INSERT INTO db_migrations(name) VALUES(?)",
            ["fix_trade_history_acceptor_perspective"]
        );
        logInfo("[migration] fix_trade_history_acceptor_perspective applied");
    }

    const backfillCompletedAtApplied = await get(
        "SELECT name FROM db_migrations WHERE name = 'backfill_album_completed_at'"
    );
    if (!backfillCompletedAtApplied) {
        const completeUsersWithoutTimestamp = await all(
            `SELECT user_id, collected_json, completed_at, updated_at
           FROM album_states
           WHERE (completed_at IS NULL OR completed_at = '')`
        );

        const requiredTotal = Math.max(0, Number(totalStickers || 0));
        const isKnownId = typeof isKnownStickerId === "function"
            ? (id) => isKnownStickerId(String(id || ""))
            : () => true;

        for (const row of completeUsersWithoutTimestamp) {
            const userId = Number(row.user_id || 0);
            if (!userId) continue;

            const finalCollected = safeParseJson(row.collected_json || "{}", {});
            const finalUnique = Object.entries(finalCollected).reduce((acc, [stickerId, count]) => {
                if (!isKnownId(stickerId)) return acc;
                return acc + (Number(count) >= 1 ? 1 : 0);
            }, 0);

            // Só faz backfill para quem está completo no estado atual.
            if (requiredTotal <= 0 || finalUnique < requiredTotal) continue;

            const [packRows, tradeRows] = await Promise.all([
                all(
                    `SELECT id, opened_at, stickers_json
               FROM pack_history
               WHERE user_id = ?
               ORDER BY opened_at ASC, id ASC`,
                    [userId]
                ),
                all(
                    `SELECT id, completed_at, offered_sticker_id, requested_sticker_id
               FROM trade_history
               WHERE user_id = ?
               ORDER BY completed_at ASC, id ASC`,
                    [userId]
                ),
            ]);

            const events = [];
            for (const packRow of packRows) {
                events.push({
                    kind: "pack",
                    id: Number(packRow.id || 0),
                    at: String(packRow.opened_at || ""),
                    stickers: safeParseJson(packRow.stickers_json || "[]", []),
                });
            }
            for (const tradeRow of tradeRows) {
                events.push({
                    kind: "trade",
                    id: Number(tradeRow.id || 0),
                    at: String(tradeRow.completed_at || ""),
                    offeredStickerId: String(tradeRow.offered_sticker_id || ""),
                    requestedStickerId: String(tradeRow.requested_sticker_id || ""),
                });
            }

            events.sort((a, b) => {
                const byDate = String(a.at).localeCompare(String(b.at));
                if (byDate !== 0) return byDate;
                if (a.kind !== b.kind) return a.kind === "pack" ? -1 : 1;
                return Number(a.id || 0) - Number(b.id || 0);
            });

            const collected = {};
            let uniqueCount = 0;
            let completedAt = "";

            const addSticker = (stickerId) => {
                const id = String(stickerId || "");
                if (!id || !isKnownId(id)) return;
                const previous = Number(collected[id] || 0);
                const next = previous + 1;
                collected[id] = next;
                if (previous < 1 && next >= 1) uniqueCount += 1;
            };

            const removeSticker = (stickerId) => {
                const id = String(stickerId || "");
                if (!id || !isKnownId(id)) return;
                const previous = Number(collected[id] || 0);
                const next = Math.max(0, previous - 1);
                collected[id] = next;
                if (previous >= 1 && next < 1) uniqueCount = Math.max(0, uniqueCount - 1);
            };

            for (const event of events) {
                if (event.kind === "pack") {
                    const stickers = Array.isArray(event.stickers) ? event.stickers : [];
                    for (const sticker of stickers) {
                        addSticker(sticker?.id);
                    }
                } else {
                    removeSticker(event.offeredStickerId);
                    addSticker(event.requestedStickerId);
                }

                if (uniqueCount >= requiredTotal) {
                    completedAt = String(event.at || "");
                    break;
                }
            }

            if (!completedAt) {
                completedAt = String(row.updated_at || "");
            }
            if (!completedAt) continue;

            const source = completedAt === String(row.updated_at || "")
                ? "fallback_updated_at"
                : "timeline";

            await run(
                `UPDATE album_states
             SET completed_at = ?
             WHERE user_id = ?
               AND (completed_at IS NULL OR completed_at = '')`,
                [completedAt, userId]
            );

            await run(
                `INSERT OR IGNORE INTO album_completed_backfill_log(user_id, completed_at, source, migration_name)
                 VALUES(?, ?, ?, 'backfill_album_completed_at')`,
                [userId, completedAt, source]
            );
        }

        await run(
            "INSERT INTO db_migrations(name) VALUES(?)",
            ["backfill_album_completed_at"]
        );
        logInfo("[migration] backfill_album_completed_at applied");
    }

    await run(
        "UPDATE users SET role = 'servidor' WHERE role = 'professor'"
    );
}

module.exports = {
    initDatabase,
};
