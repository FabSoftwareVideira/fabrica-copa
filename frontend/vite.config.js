import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

function normalizeBasePath(rawBasePath) {
    const value = String(rawBasePath || "").trim();
    if (!value) return "/copa/";
    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
    const configuredBase = process.env.VITE_BASE_PATH || "/";
    const base = mode === "development" ? "/" : normalizeBasePath(configuredBase);

    return {
        base,
        plugins: [vue()],
        server: {
            port: 5173,
            host: true,
            watch: {
                ignored: ["**/*.json"],
            },
        },
    };
});
