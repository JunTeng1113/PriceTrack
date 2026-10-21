import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const pagesBase = process.env.GITHUB_PAGES === "true" ? "/PriceTrack/" : "/"

export default defineConfig({
  base: pagesBase,
  plugins: [tailwindcss()],
  worker: {
    format: "es",
  },
})
