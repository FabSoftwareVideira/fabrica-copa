import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(rawBasePath) {
    const value = String(rawBasePath || "").trim();
    if (!value) return "/copa/";
    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
    const configuredBase = process.env.VITE_BASE_PATH || "/copa/";
    const base = mode === "development" ? "/" : normalizeBasePath(configuredBase);

    return {
        base,
        plugins: [
            vue(),
            VitePWA({
                registerType: "autoUpdate",
                manifest: {
                    name: "Album Copa 2026",
                    short_name: "Album Copa",
                    description: "Album de figurinhas da Copa do Mundo 2026",
                    theme_color: "#d9480f",
                    background_color: "#f4efe5",
                    display: "standalone",
                    scope: base,
                    start_url: base,
                    lang: "pt-BR",
                    icons: [
                        {
                            src: "favicon/android-chrome-192x192.png",
                            sizes: "192x192",
                            type: "image/png",
                            purpose: "any",
                        },
                        {
                            src: "favicon/android-chrome-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "maskable",
                        },
                    ],
                },
                workbox: {
                    cleanupOutdatedCaches: true,
                    clientsClaim: true,
                    skipWaiting: true,
                },
                devOptions: {
                    enabled: true,
                },
            }),
        ],
        server: {
            port: 5173,
            host: true,
            watch: {
                ignored: ["**/*.json"],
            },
        },
    };
});
