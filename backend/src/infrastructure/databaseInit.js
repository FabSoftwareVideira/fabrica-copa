async function initDatabase({ run, get, all, ensureColumn, logInfo }) {
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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    await ensureColumn("album_states", "trade_coins", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("album_states", "last_login_bonus_date", "TEXT NOT NULL DEFAULT ''");

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

    await run(
        "UPDATE users SET role = 'servidor' WHERE role = 'professor'"
    );
}

module.exports = {
    initDatabase,
};
