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
    await ensureColumn("album_states", "prestige_level", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("album_states", "last_prestige_at", "TEXT");
    await ensureColumn("album_states", "burn_repeats_date", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("album_states", "burn_repeats_today", "INTEGER NOT NULL DEFAULT 0");

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
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            match_datetime TEXT NOT NULL,
            home_goals INTEGER,
            away_goals INTEGER
        )
    `);
        await ensureColumn("matches", "home_goals", "INTEGER");
        await ensureColumn("matches", "away_goals", "INTEGER");

        await run(`
        CREATE TABLE IF NOT EXISTS match_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            home_goals INTEGER NOT NULL CHECK(home_goals BETWEEN 0 AND 99),
            away_goals INTEGER NOT NULL CHECK(away_goals BETWEEN 0 AND 99),
            reward_claimed_at TEXT,
            reward_claimed_coins INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, match_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
        )
    `);
        await ensureColumn("match_predictions", "reward_claimed_at", "TEXT");
        await ensureColumn("match_predictions", "reward_claimed_coins", "INTEGER NOT NULL DEFAULT 0");
        await run("CREATE INDEX IF NOT EXISTS idx_match_predictions_user_id ON match_predictions(user_id)");
        await run("CREATE INDEX IF NOT EXISTS idx_match_predictions_match_id ON match_predictions(match_id)");

    await run(`
        CREATE TABLE IF NOT EXISTS sticker_burn_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sticker_id TEXT NOT NULL,
            burned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            coins_gained INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await run("CREATE INDEX IF NOT EXISTS idx_sticker_burn_history_user_id ON sticker_burn_history(user_id)");

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

    const matchesGoalsNullableApplied = await get(
        "SELECT name FROM db_migrations WHERE name = 'matches_goals_nullable'"
    );
    if (!matchesGoalsNullableApplied) {
        const matchCols = await all("PRAGMA table_info(matches)");
        const homeGoalsCol = matchCols.find((c) => c.name === "home_goals");
        const awayGoalsCol = matchCols.find((c) => c.name === "away_goals");
        const homeGoalsNotNull = Number(homeGoalsCol?.notnull || 0) === 1;
        const awayGoalsNotNull = Number(awayGoalsCol?.notnull || 0) === 1;

        if (homeGoalsNotNull || awayGoalsNotNull) {
            await run("ALTER TABLE matches RENAME TO matches_old");
            await run(`
                CREATE TABLE matches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    home_team TEXT NOT NULL,
                    away_team TEXT NOT NULL,
                    match_datetime TEXT NOT NULL,
                    home_goals INTEGER,
                    away_goals INTEGER
                )
            `);
            await run(`
                INSERT INTO matches(id, home_team, away_team, match_datetime, home_goals, away_goals)
                SELECT id, home_team, away_team, match_datetime, home_goals, away_goals
                FROM matches_old
            `);
            await run("DROP TABLE matches_old");
        }

        await run(
            "INSERT INTO db_migrations(name) VALUES(?)",
            ["matches_goals_nullable"]
        );
        logInfo("[migration] matches_goals_nullable applied");
    }

    const matchPredictionsConstraintsApplied = await get(
        "SELECT name FROM db_migrations WHERE name = 'match_predictions_constraints_v2'"
    );
    if (!matchPredictionsConstraintsApplied) {
        const predictionCols = await all("PRAGMA table_info(match_predictions)");
        const homeGoalsCol = predictionCols.find((c) => c.name === "home_goals");
        const awayGoalsCol = predictionCols.find((c) => c.name === "away_goals");
        const needsNotNull = Number(homeGoalsCol?.notnull || 0) !== 1 || Number(awayGoalsCol?.notnull || 0) !== 1;

        const predictionChecks = await all("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'match_predictions'");
        const tableSql = String(predictionChecks?.[0]?.sql || "").toLowerCase();
        const hasHomeCheck = tableSql.includes("check(home_goals between 0 and 99)");
        const hasAwayCheck = tableSql.includes("check(away_goals between 0 and 99)");
        const needsCheck = !hasHomeCheck || !hasAwayCheck;

        if (needsNotNull || needsCheck) {
            await run("ALTER TABLE match_predictions RENAME TO match_predictions_old");
            await run(`
                CREATE TABLE match_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    match_id INTEGER NOT NULL,
                    home_goals INTEGER NOT NULL CHECK(home_goals BETWEEN 0 AND 99),
                    away_goals INTEGER NOT NULL CHECK(away_goals BETWEEN 0 AND 99),
                    reward_claimed_at TEXT,
                    reward_claimed_coins INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, match_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
                )
            `);
            await run(`
                INSERT INTO match_predictions(id, user_id, match_id, home_goals, away_goals, reward_claimed_at, reward_claimed_coins, created_at, updated_at)
                SELECT id, user_id, match_id, home_goals, away_goals, NULL, 0, created_at, updated_at
                FROM match_predictions_old
                WHERE home_goals IS NOT NULL
                  AND away_goals IS NOT NULL
                  AND home_goals BETWEEN 0 AND 99
                  AND away_goals BETWEEN 0 AND 99
            `);
            await run("DROP TABLE match_predictions_old");
            await run("CREATE INDEX IF NOT EXISTS idx_match_predictions_user_id ON match_predictions(user_id)");
            await run("CREATE INDEX IF NOT EXISTS idx_match_predictions_match_id ON match_predictions(match_id)");
        }

        await run(
            "INSERT INTO db_migrations(name) VALUES(?)",
            ["match_predictions_constraints_v2"]
        );
        logInfo("[migration] match_predictions_constraints_v2 applied");
    }

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
