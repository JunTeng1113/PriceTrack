import {
  listChipGroups,
  loadQuotes,
  loadQuotesByGroups,
  loadUsedPosts,
  loadUsedPostsByGroups,
} from "./db.ts"
import type { ModelOption } from "./model-data.ts"
import { rtxModelLabel, rtxModelLabels } from "./present.ts"

export type { ModelOption }

function parseGroups(raw: string | null): string[] {
  if (raw === null || raw.trim() === "") {
    return []
  }
  const groups: string[] = []
  for (const part of raw.split(",")) {
    const name = part.trim()
    if (name !== "" && !groups.includes(name)) {
      groups.push(name)
    }
  }
  return groups
}

export async function modelsPayload(): Promise<{ models: ModelOption[] }> {
  const groups = await listChipGroups("gpu")
  const labels = rtxModelLabels(groups)
  const models: ModelOption[] = labels.map((label) => ({
    label,
    groups: groups.filter((group) => rtxModelLabel(group) === label),
  }))
  return { models }
}

export async function seriesPayload(groupQuery: string | null = null): Promise<{ quotes: unknown[] }> {
  const groups = parseGroups(groupQuery)
  if (groups.length > 0) {
    return { quotes: await loadQuotesByGroups("gpu", groups) }
  }
  return { quotes: await loadQuotes("gpu") }
}

export async function usedPayload(groupQuery: string | null = null): Promise<{ posts: unknown[] }> {
  const groups = parseGroups(groupQuery)
  if (groups.length > 0) {
    return { posts: await loadUsedPostsByGroups(groups) }
  }
  return { posts: await loadUsedPosts() }
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
