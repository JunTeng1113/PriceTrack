type TaipeiParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const cnsExtended = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0")
}

function taipeiParts(now: Date): TaipeiParts | null {
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

export function taipeiWallClock(year: number, month: number, day: number, hour: number, minute: number, second: number): Date | null {
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

export function formatCnsTaipei(now: Date): string {
  const parts = taipeiParts(now)
  if (parts === null) {
    return ""
  }
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}T${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`
}

export function parseCapturedAt(value: string): Date | null {
  const local = cnsExtended.exec(value)
  if (local !== null) {
    return taipeiWallClock(
      Number(local[1]),
      Number(local[2]),
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6]),
    )
  }
  if (!zoned.test(value)) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

export function taipeiDate(capturedAt: string): string {
  const parsed = parseCapturedAt(capturedAt)
  if (parsed === null) {
    return ""
  }
  const parts = taipeiParts(parsed)
  if (parts === null) {
    return ""
  }
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`
}
