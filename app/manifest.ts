import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gridfinity Studio by ACMEE",
    short_name: "ACMEE Gridfinity",
    description: "Generate Gridfinity bins and baseplates in the browser and export STL or 3MF.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#800020",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
