import { existsSync } from "node:fs"
import { readFile, rename, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { decodePage } from "./page-bytes.ts"
import { isQuote } from "./quote.ts"
import {
  changesAgainstPrevious,
  coolpcPageUrl,
  ingestCoolpc,
  nextCheck,
  taipeiParts,
  type PreparedSeries,
} from "./coolpc-daily.ts"

const preparedPath = resolve("public/data/series.json")

function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms)
  })
}

function formatTaipei(now: Date): string {
  const parts = taipeiParts(now)
  if (parts === null) {
    return ""
  }
  const month = String(parts.month).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  const hour = String(parts.hour).padStart(2, "0")
  const minute = String(parts.minute).padStart(2, "0")
  return `${parts.year}-${month}-${day} ${hour}:${minute}`
}

function isPrepared(value: unknown): value is PreparedSeries {
  if (typeof value !== "object" || value === null || !("quotes" in value) || !("done" in value)) {
    return false
  }
  if (!Array.isArray(value.quotes) || !Array.isArray(value.done)) {
    return false
  }
  return value.quotes.every((quote) => isQuote(quote)) && value.done.every((item) => typeof item === "string")
}

async function readPrepared(): Promise<PreparedSeries | null> {
  if (!existsSync(preparedPath)) {
    return { quotes: [], done: [] }
  }
  const text = await readFile(preparedPath, "utf8")
  if (!text.startsWith("{")) {
    return null
  }
  const parsed: unknown = JSON.parse(text)
  if (!isPrepared(parsed)) {
    return null
  }
  return { quotes: parsed.quotes, done: parsed.done }
}

async function save(prepared: PreparedSeries): Promise<void> {
  const temporary = `${preparedPath}.tmp`
  await writeFile(temporary, JSON.stringify(prepared))
  await rename(temporary, preparedPath)
}

async function fetchPage(): Promise<{ ok: boolean; status: number; text: string } | null> {
  let status = 0
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(coolpcPageUrl(), { headers: { "user-agent": "PriceTrack" } })
    status = response.status
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      const contentType = response.headers.get("content-type") ?? ""
      return { ok: true, status, text: decodePage(bytes, contentType) }
    }
    if (status === 404 || status === 403) {
      return { ok: false, status, text: "" }
    }
    await wait(2000 * (attempt + 1))
  }
  console.error(`抓取失敗 ${status}`)
  return null
}

async function fetchOnce(): Promise<void> {
  const prepared = await readPrepared()
  if (prepared === null) {
    console.error("價格檔讀不起來，這次沒有寫入。")
    return
  }
  const fetched = await fetchPage()
  if (fetched === null || !fetched.ok) {
    if (fetched !== null) {
      console.error(`抓取失敗 ${fetched.status}`)
    }
    return
  }
  const ingested = ingestCoolpc(prepared, fetched.text)
  if (ingested.result.status === "not-vga") {
    console.error("這頁不是顯示卡估價頁。")
    return
  }
  if (ingested.result.status === "no-stamp") {
    console.error("頁面上沒有更新時間。")
    return
  }
  if (ingested.result.status === "already") {
    console.log(`這份快照已經記過 ${ingested.result.capturedAt}`)
    return
  }
  await save(ingested.prepared)
  console.log(`已記下 ${ingested.result.capturedAt}，報價 ${ingested.result.quotes}`)
  const compared = changesAgainstPrevious(prepared, ingested.prepared, ingested.result.capturedAt)
  if (compared.previousAt === null) {
    console.log("沒有上一份快照可比較")
    return
  }
  console.log(`跟上一次 ${compared.previousAt}`)
  if (compared.lines.length === 0) {
    console.log("沒有不同")
    return
  }
  for (const line of compared.lines) {
    console.log(line)
  }
}

console.log("原價屋一開就檢查一次，之後每 6 小時再檢查。程式開著才會抓。")
let due = new Date()
while (true) {
  const delay = due.getTime() - Date.now()
  if (delay > 0) {
    console.log(`下次抓取 ${formatTaipei(due)}`)
    await wait(delay)
  }
  console.log(`開始抓取 ${formatTaipei(new Date())}`)
  await fetchOnce()
  due = nextCheck(new Date())
}
