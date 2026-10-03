import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// En GitHub Pages la app vive en /<repo>/; el workflow lo pasa en BASE_PATH. En local queda en "/".
const base = process.env.BASE_PATH ?? "/"

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Plataforma Peritos Geomensores",
        short_name: "Peritos",
        description: "Shapefiles Sernageomin, acta y plano de mensura para peritos mensuradores.",
        lang: "es-CL",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f4f1ea",
        theme_color: "#0f766e",
        icons: [
          { src: "icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // La aplicación completa queda en caché: sin internet funciona todo salvo catastro e imágenes.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Teselas satelitales ya vistas: sirven sin conexión hasta 30 días.
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*\/tile\//,
            handler: "CacheFirst",
            options: { cacheName: "teselas", expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            // Catastro Sernageomin: red primero; si no hay, la última respuesta guardada.
            urlPattern: /^https:\/\/services1\.arcgis\.com\/.*\/FeatureServer\//,
            handler: "NetworkFirst",
            options: { cacheName: "catastro", networkTimeoutSeconds: 8, expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
