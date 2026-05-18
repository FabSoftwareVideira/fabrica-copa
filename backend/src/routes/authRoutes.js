const express = require("express");

function createAuthRoutes({ authController, authMiddleware }) {
    const router = express.Router();

    router.post("/auth/register", authController.registerDisabled);
    router.post("/auth/login", authController.loginDisabled);
    router.post("/auth/google", authController.authGoogle);
    router.post("/auth/refresh", authController.authRefresh);
    router.post("/auth/logout", authController.authLogout);
    router.get("/auth/me", authMiddleware, authController.authMe);

    return router;
}

module.exports = {
    createAuthRoutes,
};
