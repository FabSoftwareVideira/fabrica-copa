const {
    app,
    initializeApplication,
    getServerConfig,
    logInfo,
    logError,
} = require("./src/app");

const {
    PORT,
    NODE_ENV,
    LOG_LEVEL,
    fileLogEnabled,
    LOG_DIR,
    LOG_ROTATION_INTERVAL,
    CORS_ORIGIN,
} = getServerConfig();

initializeApplication()
    .then(() => {
        app.listen(PORT, () => {
            logInfo(`Backend do album rodando em http://localhost:${PORT}`, {
                env: NODE_ENV,
                logLevel: LOG_LEVEL,
                fileLogEnabled,
                logDir: fileLogEnabled ? LOG_DIR : null,
                rotationInterval: fileLogEnabled ? LOG_ROTATION_INTERVAL : null,
                corsOrigin: CORS_ORIGIN,
            });
        });
    })
    .catch((err) => {
        logError("Falha ao inicializar banco", { err });
        process.exit(1);
    });
