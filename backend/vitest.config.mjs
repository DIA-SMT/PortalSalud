import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs"],
    // Cada archivo usa sus propias bases SQLite en memoria.
    pool: "forks",
  },
});
