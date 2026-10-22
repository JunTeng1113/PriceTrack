export type UsedPost = {
  code: string
  date: string
  price: number
  link: string
}

export type UsedFields = {
  code: string
  date: string
  price: string
  link: string
}

export function usedPostFromFields(fields: UsedFields): UsedPost | null {
  const code = fields.code.trim()
  const date = canonicalDate(fields.date)
  const priceText = fields.price.trim()
  const link = fields.link.trim()
  if (code === "" || date === null || !isLink(link) || !/^[1-9]\d*$/.test(priceText)) {
    return null
  }
  return { code, date, price: Number(priceText), link }
}

export type CodeMatch =
  | { status: "choose"; options: readonly string[] }
  | { status: "none" }
  | { status: "narrow"; options: readonly string[] }

const brandAliases: Readonly<Record<string, string>> = {
  asus: "華碩",
  gigabyte: "技嘉",
  msi: "微星",
}

function listingBrand(code: string): string {
  if (code.startsWith("ROG-")) {
    return "華碩"
  }
  const space = code.indexOf(" ")
  if (space <= 0) {
    return code
  }
  return code.slice(0, space)
}

function tokenMatches(token: string, code: string): boolean {
  const folded = code.toLowerCase().replaceAll("-", "")
  if (folded.includes(token.replaceAll("-", ""))) {
    return true
  }
  const alias = brandAliases[token]
  return alias !== undefined && listingBrand(code) === alias
}

export function matchCodes(query: string, codes: readonly string[]): CodeMatch {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter((token) => token !== "")
  if (tokens.length === 0) {
    return { status: "none" }
  }
  const options: string[] = []
  for (const code of codes) {
    if (tokens.every((token) => tokenMatches(token, code)) && !options.includes(code)) {
      options.push(code)
    }
  }
  if (options.length === 0) {
    return { status: "none" }
  }
  if (options.length > 20) {
    return { status: "narrow", options: options.slice(0, 20) }
  }
  return { status: "choose", options }
}

export function pickCode(options: readonly string[], entry: string): string | null {
  if (!/^[1-9]\d*$/.test(entry.trim())) {
    return null
  }
  return options[Number(entry.trim()) - 1] ?? null
}

export function addUsedPost(posts: readonly UsedPost[], post: UsedPost): UsedPost[] | null {
  if (posts.some((item) => item.link === post.link && item.code === post.code && item.price === post.price)) {
    return null
  }
  return [...posts, post]
}

export type UsedBox = {
  code: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  posts: readonly UsedPost[]
}

export function usedPostsFrom(value: unknown): UsedPost[] {
  if (typeof value !== "object" || value === null || !("posts" in value) || !Array.isArray(value.posts)) {
    return []
  }
  const posts: UsedPost[] = []
  for (const item of value.posts) {
    if (!isStoredPost(item)) {
      continue
    }
    posts.push(item)
  }
  return posts
}

export function usedBoxes(
  posts: readonly UsedPost[],
  codes: readonly string[],
  range: { start: string; end: string } | null,
): UsedBox[] {
  if (range === null) {
    return []
  }
  const grouped = new Map<string, UsedPost[]>()
  for (const post of posts) {
    if (!codes.includes(post.code) || post.date < range.start || post.date > range.end) {
      continue
    }
    const list = grouped.get(post.code) ?? []
    list.push(post)
    grouped.set(post.code, list)
  }
  const boxes: UsedBox[] = []
  for (const code of codes) {
    const list = grouped.get(code)
    if (list === undefined) {
      continue
    }
    const box = boxOf(code, list)
    if (box !== null) {
      boxes.push(box)
    }
  }
  return boxes
}

function boxOf(code: string, posts: readonly UsedPost[]): UsedBox | null {
  if (posts.length === 0) {
    return null
  }
  const prices = posts.map((post) => post.price).sort((left, right) => left - right)
  const count = prices.length
  const min = prices[0] ?? 0
  const max = prices[count - 1] ?? min
  if (count === 1) {
    return { code, min, q1: min, median: min, q3: min, max, posts }
  }
  const lowerEnd = Math.floor(count / 2)
  const upperStart = count % 2 === 1 ? lowerEnd + 1 : lowerEnd
  return {
    code,
    min,
    q1: medianOf(prices, 0, lowerEnd),
    median: medianOf(prices, 0, count),
    q3: medianOf(prices, upperStart, count),
    max,
    posts,
  }
}

function medianOf(sorted: readonly number[], start: number, end: number): number {
  const count = end - start
  if (count <= 0) {
    return sorted[start] ?? 0
  }
  const mid = start + Math.floor(count / 2)
  if (count % 2 === 1) {
    return sorted[mid] ?? 0
  }
  const left = sorted[mid - 1] ?? 0
  const right = sorted[mid] ?? 0
  return (left + right) / 2
}

function isStoredPost(value: unknown): value is UsedPost {
  if (typeof value !== "object" || value === null) {
    return false
  }
  return "code" in value && typeof value.code === "string"
    && "date" in value && typeof value.date === "string"
    && "price" in value && typeof value.price === "number"
    && "link" in value && typeof value.link === "string"
}

function canonicalDate(value: string): string | null {
  const compact = value.trim().replaceAll(/\s/g, "")
  const match = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/.exec(compact)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) {
    return null
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function isLink(value: string): boolean {
  const marker = "://"
  const scheme = value.startsWith("https://") ? "https" : value.startsWith("http://") ? "http" : ""
  if (scheme === "") {
    return false
  }
  const rest = value.slice(scheme.length + marker.length)
  return rest.includes(".") && !rest.includes(" ")
}
