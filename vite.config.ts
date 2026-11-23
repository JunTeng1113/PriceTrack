import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { priceTrackApiPlugin } from "./src/vite-api-plugin.ts"

const pagesBase = process.env.GITHUB_PAGES === "true" ? "/PriceTrack/" : "/"

export default defineConfig({
  base: pagesBase,
  plugins: [tailwindcss(), priceTrackApiPlugin()],
  worker: {
    format: "es",
  },
})
