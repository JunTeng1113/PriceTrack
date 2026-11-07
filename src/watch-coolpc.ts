import { existsSync, mkdirSync } from "node:fs"
import { readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { decodePage } from "./page-bytes.ts"
import { isQuote } from "./quote.ts"
import {
  changesAgainstPrevious,
  coolpcPageUrl,
  ingestCoolpc,
  ingestMemory,
  nextCheck,
  type PreparedSeries,
} from "./coolpc-daily.ts"
import { formatCnsTaipei } from "./taipei-time.ts"

const preparedPath = resolve("public/data/series.json")
const memoryPath = resolve("data/memory-series.json")

function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms)
  })
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

async function readPrepared(path: string): Promise<PreparedSeries | null> {
  if (!existsSync(path)) {
    return { quotes: [], done: [] }
  }
  const text = await readFile(path, "utf8")
  if (!text.startsWith("{")) {
    return null
  }
  const parsed: unknown = JSON.parse(text)
  if (!isPrepared(parsed)) {
    return null
  }
  return { quotes: parsed.quotes, done: parsed.done }
}

async function save(path: string, prepared: PreparedSeries): Promise<void> {
  const directory = dirname(path)
  if (!existsSync(directory)) {
    mkdirSync(directory)
  }
  const temporary = `${path}.tmp`
  await writeFile(temporary, JSON.stringify(prepared))
  await rename(temporary, path)
}

function reportChanges(label: string, before: PreparedSeries, after: PreparedSeries, capturedAt: string): void {
  const compared = changesAgainstPrevious(before, after, capturedAt)
  if (compared.previousAt === null) {
    console.log(`${label}沒有上一份快照可比較`)
    return
  }
  console.log(`${label}跟上一次 ${compared.previousAt}`)
  if (compared.lines.length === 0) {
    console.log(`${label}沒有不同`)
    return
  }
  for (const line of compared.lines) {
    console.log(line)
  }
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
  const prepared = await readPrepared(preparedPath)
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
  const capturedAt = ingested.result.capturedAt
  if (ingested.result.status === "saved") {
    await save(preparedPath, ingested.prepared)
    console.log(`已記下顯示卡 ${capturedAt}，報價 ${ingested.result.quotes}`)
    reportChanges("顯示卡", prepared, ingested.prepared, capturedAt)
  }
  await recordMemory(fetched.text, capturedAt, ingested.result.status === "already")
}

async function recordMemory(html: string, capturedAt: string, gpuAlready: boolean): Promise<void> {
  const prepared = await readPrepared(memoryPath)
  if (prepared === null) {
    console.error("記憶體報價讀不起來，這次沒有寫入記憶體。")
    if (gpuAlready) {
      console.log(`這份快照已經記過 ${capturedAt}`)
    }
    return
  }
  const ingested = ingestMemory(prepared, html, capturedAt)
  if (ingested.status === "no-menu") {
    console.error("這頁沒有記憶體選單。")
    if (gpuAlready) {
      console.log(`這份快照已經記過 ${capturedAt}`)
    }
    return
  }
  if (ingested.status === "already") {
    console.log(gpuAlready ? `這份快照已經記過 ${capturedAt}` : `記憶體這份快照已經記過 ${capturedAt}`)
    return
  }
  await save(memoryPath, ingested.prepared)
  console.log(`已記下記憶體 ${capturedAt}，報價 ${ingested.quotes}`)
  reportChanges("記憶體", prepared, ingested.prepared, capturedAt)
}

console.log("原價屋一開就檢查一次，之後每 6 小時再檢查。程式開著才會抓。")
let due = new Date()
while (true) {
  const delay = due.getTime() - Date.now()
  if (delay > 0) {
    console.log(`下次抓取 ${formatCnsTaipei(due)}`)
    await wait(delay)
  }
  console.log(`開始抓取 ${formatCnsTaipei(new Date())}`)
  await fetchOnce()
  due = nextCheck(new Date())
}
