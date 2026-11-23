import type { Plugin } from "vite"
import { config as loadEnv } from "dotenv"
import { seriesPayload, usedPayload, jsonResponse } from "./api-data.ts"

loadEnv()

function writeResponse(res: import("node:http").ServerResponse, result: Response): void {
  res.statusCode = result.status
  for (const [key, value] of result.headers.entries()) {
    res.setHeader(key, value)
  }
  void result.text().then((text) => {
    res.end(text)
  })
}

export function priceTrackApiPlugin(): Plugin {
  return {
    name: "pricetrack-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? ""
        if (req.method === "OPTIONS" && (path === "/api/series" || path === "/api/used")) {
          res.statusCode = 204
          res.setHeader("access-control-allow-origin", "*")
          res.setHeader("access-control-allow-methods", "GET, OPTIONS")
          res.end()
          return
        }
        if (req.method !== "GET") {
          next()
          return
        }
        if (path === "/api/series") {
          void seriesPayload()
            .then((body) => writeResponse(res, jsonResponse(body)))
            .catch((error: unknown) => {
              console.error(error)
              writeResponse(res, jsonResponse({ error: "series failed" }, 500))
            })
          return
        }
        if (path === "/api/used") {
          void usedPayload()
            .then((body) => writeResponse(res, jsonResponse(body)))
            .catch((error: unknown) => {
              console.error(error)
              writeResponse(res, jsonResponse({ error: "used failed" }, 500))
            })
          return
        }
        next()
      })
    },
  }
}
