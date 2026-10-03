import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(import.meta.dirname, "..")],
    },
  },
  resolve: {
    alias: {
      // Absolute aliases keep module identity stable: test files live outside
      // frontend/, so bare specifiers like "react-konva" would otherwise resolve
      // differently (and fail) there, which silently breaks vi.mock().
      "react-konva": path.resolve(import.meta.dirname, "node_modules/react-konva"),
      "react": path.resolve(import.meta.dirname, "node_modules/react"),
      "react/jsx-dev-runtime": path.resolve(import.meta.dirname, "node_modules/react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
      "react-dom/client": path.resolve(import.meta.dirname, "node_modules/react-dom/client.js"),
      "react/jsx-runtime": path.resolve(import.meta.dirname, "node_modules/react/jsx-runtime.js"),
      "@": path.resolve(import.meta.dirname, "./src"),
      "@tests": path.resolve(import.meta.dirname, "../tests/frontend"),
      "@wailsjs": path.resolve(import.meta.dirname, "./wailsjs"),
      "@testing-library/user-event": path.resolve(import.meta.dirname, "node_modules/@testing-library/user-event"),
      "fake-indexeddb": path.resolve(import.meta.dirname, "node_modules/fake-indexeddb"),
      "@testing-library/jest-dom": path.resolve(import.meta.dirname, "node_modules/@testing-library/jest-dom"),
      "@testing-library/react": path.resolve(import.meta.dirname, "node_modules/@testing-library/react"),
      "fake-indexeddb/auto": path.resolve(import.meta.dirname, "node_modules/fake-indexeddb/auto"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["../tests/frontend/test-setup.ts"],
    include: ["../tests/frontend/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "../tests/frontend/test-setup.ts",
        "../tests/frontend/test-support/**",
        "src/main.tsx",
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/wailsjs/**",
        "src/vite-env.d.ts",
      ],
    },
  },
});
