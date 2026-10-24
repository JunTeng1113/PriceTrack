import { update, type PriceSeries, type Snapshot } from "./present.ts"

const pageUrl = "https://www.coolpc.com.tw/evaluate.php"
const checkIntervalMs = 6 * 60 * 60 * 1000

export type PreparedSeries = {
  quotes: PriceSeries["quotes"]
  done: string[]
}

export type IngestStatus =
  | { status: "not-vga" }
  | { status: "no-stamp" }
  | { status: "already"; capturedAt: string }
  | { status: "saved"; capturedAt: string; quotes: number }

type TaipeiParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function coolpcPageUrl(): string {
  return pageUrl
}

export function taipeiParts(now: Date): TaipeiParts | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const text = parts.find((part) => part.type === type)?.value
    if (text === undefined || !/^\d+$/.test(text)) {
      return null
    }
    return Number(text)
  }
  const year = read("year")
  const month = read("month")
  const day = read("day")
  const hour = read("hour")
  const minute = read("minute")
  const second = read("second")
  if (year === null || month === null || day === null || hour === null || minute === null || second === null) {
    return null
  }
  return { year, month, day, hour, minute, second }
}

function taipeiWallClock(year: number, month: number, day: number, hour: number, minute: number, second: number): Date | null {
  const candidate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second))
  const parts = taipeiParts(candidate)
  if (
    parts === null
    || parts.year !== year
    || parts.month !== month
    || parts.day !== day
    || parts.hour !== hour
    || parts.minute !== minute
    || parts.second !== second
  ) {
    return null
  }
  return candidate
}

export function nextCheck(after: Date): Date {
  return new Date(after.getTime() + checkIntervalMs)
}

export function siteCapturedAt(html: string): string | null {
  const stamp = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?!:)\s*<span[^>]*>&#xe1db;/i.exec(html)
  if (stamp === null) {
    return null
  }
  const year = Number(stamp[1])
  const month = Number(stamp[2])
  const day = Number(stamp[3])
  const hour = Number(stamp[4])
  const minute = Number(stamp[5])
  const clock = taipeiWallClock(year, month, day, hour, minute, 0)
  if (clock === null) {
    return null
  }
  return clock.toISOString()
}

export function ingestCoolpc(prepared: PreparedSeries, html: string): { prepared: PreparedSeries; result: IngestStatus } {
  if (!html.includes("顯示卡VGA")) {
    return { prepared, result: { status: "not-vga" } }
  }
  const capturedAt = siteCapturedAt(html)
  if (capturedAt === null) {
    return { prepared, result: { status: "no-stamp" } }
  }
  if (prepared.done.includes(capturedAt)) {
    return { prepared, result: { status: "already", capturedAt } }
  }
  const snapshot: Snapshot = { capturedAt, html, source: "估價頁" }
  const series = update({ quotes: prepared.quotes }, [snapshot])
  return {
    prepared: { quotes: series.quotes, done: [...prepared.done, capturedAt] },
    result: { status: "saved", capturedAt, quotes: series.quotes.length },
  }
}
