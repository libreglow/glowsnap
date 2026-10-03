import { defineConfig } from "../../frontend/node_modules/vitest/config";
import react from "../../frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve, dirname } from "node:path";

const rootDir = dirname(new URL(import.meta.url).pathname);
const frontendRoot = resolve(rootDir, "../../frontend");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(frontendRoot, "src"),
      "@tests": rootDir,
      "@wailsjs": resolve(frontendRoot, "wailsjs"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [resolve(rootDir, "test-setup.ts")],
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
