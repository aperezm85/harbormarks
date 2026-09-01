import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    testTimeout: 30000,
    include: ["src/**/*.test.ts", "migrations/**/*.test.ts"],
   },
})
