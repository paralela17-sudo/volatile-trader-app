import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            // Shims para módulos Node que não devem ir para o navegador
            "fs": path.resolve(__dirname, "src/shims/node-shim.js"),
            "path": path.resolve(__dirname, "src/shims/node-shim.js"),
            "crypto": path.resolve(__dirname, "src/shims/node-shim.js"),
            "os": path.resolve(__dirname, "src/shims/node-shim.js"),
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            external: [], // Deixe vazio para que os aliases funcionem
        }
    },
    optimizeDeps: {
        exclude: ["fs", "path", "crypto"]
    }
});
