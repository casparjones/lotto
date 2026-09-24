import { defineConfig } from "vite";

// Relative Pfade: die Seite läuft unter tests/<datum>/ und im iframe der Übersicht.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
