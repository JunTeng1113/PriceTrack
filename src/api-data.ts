import { loadQuotes, loadUsedPosts } from "./db.ts"

export async function seriesPayload(): Promise<{ quotes: unknown[] }> {
  const quotes = await loadQuotes("gpu")
  return { quotes }
}

export async function usedPayload(): Promise<{ posts: unknown[] }> {
  const posts = await loadUsedPosts()
  return { posts }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "no-store",
    },
  })
}
