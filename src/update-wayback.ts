import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { chooseCaptures, parseCdx, snapshotUrl } from "./captures.ts"
import { decodePage } from "./page-bytes.ts"
import { emptySeries, update, type PriceSeries, type Snapshot } from "./present.ts"

const range = { start: "2020-01-01", end: "2026-10-21" }
const preparedPath = resolve("public/data/series.json")
const cdxUrl = "https://web.archive.org/cdx/search/cdx?url=www.coolpc.com.tw/evaluate.php&from=20191231&to=20261022&output=json&fl=timestamp,original,statuscode&filter=statuscode:200"

type PreparedFile = {
  quotes: PriceSeries["quotes"]
  done: string[]
}

const emptyPrepared = (): PreparedFile => ({ quotes: [], done: [] })

function isPrepared(value: unknown): value is PreparedFile {
  if (typeof value !== "object" || value === null || !("quotes" in value) || !("done" in value)) {
    return false
  }
  return Array.isArray(value.quotes) && Array.isArray(value.done)
}

async function readPrepared(): Promise<PreparedFile> {
  if (!existsSync(preparedPath)) {
    return emptyPrepared()
  }
  const text = await readFile(preparedPath, "utf8")
  if (!text.startsWith("{")) {
    return emptyPrepared()
  }
  const parsed: unknown = JSON.parse(text)
  if (!isPrepared(parsed)) {
    return emptyPrepared()
  }
  const done = parsed.done.filter((item): item is string => typeof item === "string")
  return { quotes: parsed.quotes, done }
}

async function save(prepared: PreparedFile): Promise<void> {
  await mkdir(dirname(preparedPath), { recursive: true })
  const temporary = `${preparedPath}.tmp`
  await writeFile(temporary, JSON.stringify(prepared))
  await rename(temporary, preparedPath)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string } | null> {
  let status = 0
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "PriceTrack" } })
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
  console.error(`gave up ${status} ${url}`)
  return null
}

const cdxResponse = await fetch(cdxUrl, { headers: { "user-agent": "PriceTrack" } })
if (!cdxResponse.ok) {
  console.error(`CDX ${cdxResponse.status}`)
  process.exitCode = 1
} else {
  const cdxText = await cdxResponse.text()
  const parsed: unknown = cdxText.startsWith("[") ? JSON.parse(cdxText) : null
  const chosen = chooseCaptures(parseCdx(parsed), range)
  console.log(`captures ${chosen.length}`)
  const prepared = await readPrepared()
  const done = new Set(prepared.done)
  let series: PriceSeries = prepared.quotes.length === 0 ? emptySeries() : { quotes: prepared.quotes }
  let index = 0
  for (const capture of chosen) {
    index += 1
    if (done.has(capture.capturedAt)) {
      continue
    }
    const fetched = await fetchText(snapshotUrl(capture))
    if (fetched === null) {
      continue
    }
    if (fetched.ok && fetched.text.includes("顯示卡VGA")) {
      const snapshot: Snapshot = { capturedAt: capture.capturedAt, html: fetched.text }
      series = update(series, [snapshot])
      done.add(capture.capturedAt)
    }
    if (!fetched.ok) {
      done.add(capture.capturedAt)
    }
    prepared.quotes = series.quotes
    prepared.done = [...done]
    await save(prepared)
    console.log(`${index}/${chosen.length} ${capture.date} quotes ${series.quotes.length}`)
    await wait(1000)
  }
  console.log(`done ${series.quotes.length} quotes, ${chosen.length} days`)
}
