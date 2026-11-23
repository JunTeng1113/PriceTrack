import { brandPaint } from "../present.ts"
import {
  addDays,
  dayNumber,
  labelStyle,
  plotBottom,
  plotLeft,
  plotRight,
  plotTop,
  priceAxisX,
  priceTicks,
  seriesNameX,
  spreadLabelYs,
  xAt,
  yAt,
} from "./geometry.ts"

export type PriceQuoteMark = {
  date: string
  sellingPrice: number
  dashed?: boolean
  delisted?: boolean
}

export type PriceSeriesLine = {
  code: string
  colorIndex?: number
  quotes: readonly PriceQuoteMark[]
}

export type ChartMark =
  | {
      kind: "frame"
      start: string
      end: string
      axis: { lower: number; upper: number }
      horizontal: string
      vertical: string
      xLabels: readonly { date: string; label: string; x: number; hidden: boolean }[]
      yLabels: readonly { price: number; y: number; text: string }[]
    }
  | {
      kind: "segment"
      code: string
      fromDate: string
      fromPrice: number
      toDate: string
      toPrice: number
      x1: number
      y1: number
      x2: number
      y2: number
      paint: string
      dashed: boolean
      opacity: string
      hit: boolean
    }
  | {
      kind: "point"
      code: string
      date: string
      price: number
      x: number
      y: number
      paint: string
      delisted: boolean
      opacity: string
    }
  | {
      kind: "label"
      code: string
      paint: string
      opacity: string
      focused: string
      x: number
      y: number
      fontSize: number
    }

function formatPrice(value: number): string {
  const rounded = Math.round(value)
  const negative = rounded < 0
  const digits = String(Math.abs(rounded))
  let grouped = ""
  for (let index = 0; index < digits.length; index += 1) {
    const remaining = digits.length - index
    if (index > 0 && remaining % 3 === 0) {
      grouped += ","
    }
    grouped += digits.charAt(index)
  }
  return negative ? `-$${grouped}` : `$${grouped}`
}

function monthLastDay(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function completeMonth(start: string, end: string, label: string): boolean {
  const year = Number(label.slice(0, 4))
  const month = Number(label.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return false
  }
  const first = `${label}-01`
  return start <= first && end >= monthLastDay(year, month)
}

function monthDayCount(start: string, end: string, label: string): number {
  const year = Number(label.slice(0, 4))
  const month = Number(label.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0
  }
  const first = `${label}-01`
  const last = monthLastDay(year, month)
  const from = start > first ? start : first
  const to = end < last ? end : last
  if (from > to) {
    return 0
  }
  return dayNumber(to) - dayNumber(from) + 1
}

function monthTicks(start: string, end: string): { date: string; label: string }[] {
  const ticks: { date: string; label: string }[] = []
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return ticks
  }
  const endKey = end.slice(0, 7)
  while (ticks.length < 240) {
    const label = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
    if (label > endKey) {
      break
    }
    const first = `${label}-01`
    const date = first < start ? start : first > end ? end : first
    ticks.push({ date, label })
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return ticks
}

function seriesColor(index: number): string {
  return brandPaint(index)
}

export function buildPriceMarks(
  series: readonly PriceSeriesLine[],
  axis: { lower: number; upper: number },
  connectGaps = false,
  focus = "",
): ChartMark[] {
  let start = ""
  let end = ""
  for (const item of series) {
    for (const quote of item.quotes) {
      if (start === "" || quote.date < start) {
        start = quote.date
      }
      if (quote.date > end) {
        end = quote.date
      }
    }
  }
  if (start === "" || end === "") {
    return []
  }
  const startDay = dayNumber(start)
  const endDay = dayNumber(end)
  const daySpan = endDay - startDay
  const months = monthTicks(start, end)
  const prices = priceTicks(axis.lower, axis.upper)
  const horizontal = prices
    .map((price) => {
      const y = yAt(price, axis)
      return `M${plotLeft} ${y} H${plotRight}`
    })
    .join(" ")
  const vertical = months
    .map((tick) => {
      const x = xAt(tick.date, startDay, daySpan)
      return `M${x} ${plotTop} V${plotBottom}`
    })
    .join(" ")
  const firstLabel = months[0]?.label ?? ""
  const lastLabel = months[months.length - 1]?.label ?? ""
  const firstDays = firstLabel === "" ? 0 : monthDayCount(start, end, firstLabel)
  const lastDays = lastLabel === "" ? 0 : monthDayCount(start, end, lastLabel)
  const xLabels = months.map((tick, index) => {
    let hidden = false
    if (index === 0 && !completeMonth(start, end, tick.label)) {
      hidden = true
    }
    if (index === 1 && firstDays < 14) {
      hidden = true
    }
    if (index === months.length - 1 && lastDays < 14) {
      hidden = true
    }
    return {
      date: tick.date,
      label: tick.label,
      x: xAt(tick.date, startDay, daySpan),
      hidden,
    }
  })
  const yLabels = prices.map((price) => ({
    price,
    y: yAt(price, axis),
    text: formatPrice(price),
  }))
  const marks: ChartMark[] = [
    {
      kind: "frame",
      start,
      end,
      axis,
      horizontal,
      vertical,
      xLabels,
      yLabels,
    },
  ]
  const labels: { code: string; paint: string; opacity: string; focused: string; y: number }[] = []
  for (const [seriesIndex, item] of series.entries()) {
    const paint = connectGaps ? seriesColor(item.colorIndex ?? seriesIndex) : "currentColor"
    const opacity = focus !== "" && focus !== item.code ? "0.25" : "1"
    let previous: { date: string; price: number; x: number; y: number; dashed: boolean } | null = null
    for (const quote of item.quotes) {
      const x = xAt(quote.date, startDay, daySpan)
      const y = yAt(quote.sellingPrice, axis)
      const dashed = quote.dashed === true
      const delisted = quote.delisted === true
      if (previous !== null && (connectGaps || addDays(previous.date, 1) === quote.date)) {
        const dashedStroke = dashed || previous.dashed
        marks.push({
          kind: "segment",
          code: item.code,
          fromDate: previous.date,
          fromPrice: previous.price,
          toDate: quote.date,
          toPrice: quote.sellingPrice,
          x1: previous.x,
          y1: previous.y,
          x2: x,
          y2: y,
          paint,
          dashed: dashedStroke,
          opacity,
          hit: false,
        })
        marks.push({
          kind: "segment",
          code: item.code,
          fromDate: previous.date,
          fromPrice: previous.price,
          toDate: quote.date,
          toPrice: quote.sellingPrice,
          x1: previous.x,
          y1: previous.y,
          x2: x,
          y2: y,
          paint: "transparent",
          dashed: false,
          opacity: "1",
          hit: true,
        })
      }
      marks.push({
        kind: "point",
        code: item.code,
        date: quote.date,
        price: quote.sellingPrice,
        x,
        y,
        paint,
        delisted,
        opacity,
      })
      previous = { date: quote.date, price: quote.sellingPrice, x, y, dashed }
    }
    if (previous !== null) {
      labels.push({
        code: item.code,
        paint,
        opacity,
        focused: focus === item.code ? "true" : "false",
        y: previous.y,
      })
    }
  }
  const style = labelStyle(labels.length)
  const labelYs = spreadLabelYs(
    labels.map((label) => label.y),
    style.gap,
  )
  for (const [index, label] of labels.entries()) {
    marks.push({
      kind: "label",
      code: label.code,
      paint: label.paint,
      opacity: label.opacity,
      focused: label.focused,
      x: seriesNameX,
      y: labelYs[index] ?? label.y,
      fontSize: style.fontSize,
    })
  }
  return marks
}

export function formatAxisPrice(value: number): string {
  return formatPrice(value)
}
