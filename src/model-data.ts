import { isQuote } from "./quote.ts"
import type { PriceSeries } from "./present.ts"
import { usedPostsFrom, type UsedPost } from "./used-post.ts"

export type ModelOption = {
  label: string
  groups: readonly string[]
}

const apiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? ""

function groupsQuery(groups: readonly string[]): string {
  return groups.map((group) => encodeURIComponent(group)).join(",")
}

export async function fetchModelCatalog(): Promise<ModelOption[]> {
  const response = await fetch(`${apiBase()}/api/models`)
  if (!response.ok) {
    return []
  }
  const body: unknown = await response.json()
  if (typeof body !== "object" || body === null || !("models" in body) || !Array.isArray(body.models)) {
    return []
  }
  const models: ModelOption[] = []
  for (const item of body.models) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    if (!("label" in item) || typeof item.label !== "string") {
      continue
    }
    if (!("groups" in item) || !Array.isArray(item.groups)) {
      continue
    }
    const groups = item.groups.filter((group): group is string => typeof group === "string")
    if (groups.length === 0) {
      continue
    }
    models.push({ label: item.label, groups })
  }
  return models
}

export async function fetchQuotesForGroups(
  groups: readonly string[],
): Promise<PriceSeries["quotes"][number][]> {
  if (groups.length === 0) {
    return []
  }
  const response = await fetch(`${apiBase()}/api/series?groups=${groupsQuery(groups)}`)
  if (!response.ok) {
    return []
  }
  const body: unknown = await response.json()
  if (typeof body !== "object" || body === null || !("quotes" in body) || !Array.isArray(body.quotes)) {
    return []
  }
  const quotes: PriceSeries["quotes"][number][] = []
  for (const item of body.quotes) {
    if (isQuote(item)) {
      quotes.push(item)
    }
  }
  return quotes
}

export async function fetchUsedForGroups(groups: readonly string[]): Promise<UsedPost[]> {
  if (groups.length === 0) {
    return []
  }
  const response = await fetch(`${apiBase()}/api/used?groups=${groupsQuery(groups)}`)
  if (!response.ok) {
    return []
  }
  const body: unknown = await response.json()
  return usedPostsFrom(body)
}
