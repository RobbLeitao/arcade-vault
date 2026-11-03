import type { MetadataRoute } from "next";

// PWA instalable (sin service worker ni modo offline: fuera de alcance).
// Colores = token --bg de app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcade Vault",
    short_name: "Arcade Vault",
    description:
      "Plataforma arcade retro: juega en el navegador y compite por la puntuación más alta.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
