import { config as loadEnv } from "dotenv"
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, resolve, sep } from "node:path"
import { seriesPayload, usedPayload, jsonResponse } from "./api-data.ts"
import { closePool } from "./db.ts"

loadEnv()

const port = Number(process.env.PORT ?? "8787")
const distRoot = resolve(import.meta.dirname, "../dist")

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
}

function safeDistPath(pathname: string): string | null {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "")
  const resolved = resolve(distRoot, normalize(relative))
  if (!resolved.startsWith(distRoot + sep) && resolved !== distRoot) {
    return null
  }
  return resolved
}

function sendFile(response: import("node:http").ServerResponse, filePath: string): void {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not Found")
    return
  }
  const type = mimeTypes[extname(filePath)] ?? "application/octet-stream"
  response.writeHead(200, { "content-type": type })
  createReadStream(filePath).pipe(response)
}

function sendJson(response: import("node:http").ServerResponse, result: Response): void {
  response.writeHead(result.status, Object.fromEntries(result.headers.entries()))
  void result.text().then((text) => {
    response.end(text)
  })
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    })
    response.end()
    return
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" })
    response.end("Method Not Allowed")
    return
  }

  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" })
    response.end(JSON.stringify({ ok: true }))
    return
  }

  if (url.pathname === "/api/series" || url.pathname === "/series") {
    void seriesPayload()
      .then((body) => sendJson(response, jsonResponse(body)))
      .catch((error: unknown) => {
        console.error(error)
        sendJson(response, jsonResponse({ error: "series failed" }, 500))
      })
    return
  }
  if (url.pathname === "/api/used" || url.pathname === "/used") {
    void usedPayload()
      .then((body) => sendJson(response, jsonResponse(body)))
      .catch((error: unknown) => {
        console.error(error)
        sendJson(response, jsonResponse({ error: "used failed" }, 500))
      })
    return
  }

  const assetPath = safeDistPath(url.pathname)
  if (assetPath !== null && existsSync(assetPath) && statSync(assetPath).isFile()) {
    sendFile(response, assetPath)
    return
  }

  const indexPath = join(distRoot, "index.html")
  if (existsSync(indexPath)) {
    sendFile(response, indexPath)
    return
  }

  response.writeHead(503, { "content-type": "text/plain; charset=utf-8" })
  response.end("Frontend not built. Run npm run build.")
})

server.listen(port, () => {
  console.log(`PriceTrack web+api on :${port} (dist=${distRoot})`)
})

process.on("SIGINT", () => {
  void closePool().then(() => {
    server.close()
    process.exit(0)
  })
})
