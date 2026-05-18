const express = require("express");

function createSystemRoutes({ systemController, swaggerSpec }) {
    const router = express.Router();

    router.get("/docs.json", (req, res) => systemController.docsJson(swaggerSpec, req, res));
    router.get("/health", systemController.health);
    router.post("/logs/frontend-error", systemController.frontendError);

    return router;
}

module.exports = {
    createSystemRoutes,
};
