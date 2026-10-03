import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const testsRoot = path.resolve(import.meta.dirname, "tests/frontend");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "frontend/src"),
      "@tests": testsRoot,
      "@wailsjs": path.resolve(import.meta.dirname, "frontend/wailsjs"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(testsRoot, "test-setup.ts")],
    include: [path.resolve(testsRoot, "**/*.{test,spec}.{ts,tsx}")],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["frontend/src/**/*.{ts,tsx}"],
      exclude: [
        "frontend/src/main.tsx",
        "frontend/src/**/*.{test,spec}.{ts,tsx}",
        "frontend/wailsjs/**",
      ],
    },
  },
});
