export type CaptureRow = {
  timestamp: string
  original: string
  status: string
}

export type ChosenCapture = {
  timestamp: string
  original: string
  capturedAt: string
  date: string
}

export function chooseCaptures(
  rows: readonly CaptureRow[],
  range: { start: string; end: string },
): ChosenCapture[] {
  const latest = new Map<string, ChosenCapture>()
  for (const row of rows) {
    if (row.status !== "200" || !isEstimatePage(row.original)) {
      continue
    }
    const capturedAt = capturedAtFromTimestamp(row.timestamp)
    if (capturedAt === null) {
      continue
    }
    const date = taipeiDate(capturedAt)
    if (date === "" || date < range.start || date > range.end) {
      continue
    }
    const current = latest.get(date)
    if (current !== undefined && current.timestamp >= row.timestamp) {
      continue
    }
    latest.set(date, {
      timestamp: row.timestamp,
      original: row.original,
      capturedAt,
      date,
    })
  }
  return [...latest.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
}

export function parseCdx(value: unknown): CaptureRow[] {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }
  const header = value[0]
  if (!Array.isArray(header)) {
    return []
  }
  const timestampAt = header.indexOf("timestamp")
  const originalAt = header.indexOf("original")
  const statusAt = header.indexOf("statuscode")
  if (timestampAt < 0 || originalAt < 0 || statusAt < 0) {
    return []
  }
  const rows: CaptureRow[] = []
  for (const item of value.slice(1)) {
    if (!Array.isArray(item)) {
      continue
    }
    const timestamp = item[timestampAt]
    const original = item[originalAt]
    const status = item[statusAt]
    if (typeof timestamp !== "string" || typeof original !== "string" || typeof status !== "string") {
      continue
    }
    rows.push({ timestamp, original, status })
  }
  return rows
}

export function snapshotUrl(capture: { timestamp: string; original: string }): string {
  return `https://web.archive.org/web/${capture.timestamp}id_/${capture.original}`
}

function isEstimatePage(original: string): boolean {
  if (!original.startsWith("http://") && !original.startsWith("https://")) {
    return false
  }
  const parsed = new URL(original)
  return parsed.pathname === "/evaluate.php" || parsed.pathname === "/evaluate.php/"
}

function capturedAtFromTimestamp(timestamp: string): string | null {
  if (!/^\d{14}$/.test(timestamp)) {
    return null
  }
  return [
    timestamp.slice(0, 4),
    "-",
    timestamp.slice(4, 6),
    "-",
    timestamp.slice(6, 8),
    "T",
    timestamp.slice(8, 10),
    ":",
    timestamp.slice(10, 12),
    ":",
    timestamp.slice(12, 14),
    ".000Z",
  ].join("")
}

function taipeiDate(capturedAt: string): string {
  const parsed = new Date(capturedAt)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed)
}
