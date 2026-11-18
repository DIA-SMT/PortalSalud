import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo la API se sirve por el mismo origen (proxy) para que la cookie
// de sesión sea de primera parte y SameSite=Strict funcione sin CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:4010",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});
