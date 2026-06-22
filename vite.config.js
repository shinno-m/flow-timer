import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from /flow-timer/.
// For local dev/preview the same base is harmless.
const BASE = "/flow-timer/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-180.png", "apple-touch-icon.png"],
      manifest: {
        name: "Flow",
        short_name: "Flow",
        description: "25分集中 + 5分休憩の朝のポモドーロタイマー",
        lang: "ja",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache everything the build emits so the app launches fully offline.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: BASE + "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
