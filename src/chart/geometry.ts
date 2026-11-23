/** Shared chart plot geometry for string SVG and React SVG. */

export const plotLeft = 4
export const plotRight = 270
export const priceAxisX = plotRight
export const seriesNameX = priceAxisX + 24
export const labelSize = 3.2
export const labelGap = 3.6
export const labelTop = 2
export const labelBottom = 98
export const plotTop = 4
export const plotBottom = 84
export const plotSpan = plotRight - plotLeft
export const axisGutter = 400 - plotRight

export function dayNumber(isoDate: string): number {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function addDays(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

export function xAt(date: string, startDay: number, daySpan: number): number {
  if (daySpan === 0) {
    return (plotLeft + plotRight) / 2
  }
  return plotLeft + ((dayNumber(date) - startDay) / daySpan) * (plotRight - plotLeft)
}

export function yAt(price: number, axis: { lower: number; upper: number }): number {
  const span = axis.upper - axis.lower
  if (span === 0) {
    return (plotTop + plotBottom) / 2
  }
  return plotTop + (1 - (price - axis.lower) / span) * (plotBottom - plotTop)
}

export function labelStyle(count: number): { fontSize: number; gap: number } {
  if (count <= 1) {
    return { fontSize: labelSize, gap: labelGap }
  }
  const fitted = (labelBottom - labelTop) / (count - 1)
  if (fitted >= labelGap) {
    return { fontSize: labelSize, gap: labelGap }
  }
  return { fontSize: fitted * 0.9, gap: fitted }
}

export function spreadLabelYs(preferred: readonly number[], gap: number): number[] {
  const count = preferred.length
  if (count === 0) {
    return []
  }
  const only = preferred[0] ?? labelTop
  if (count === 1) {
    return [Math.min(labelBottom, Math.max(labelTop, only))]
  }
  const order = preferred.map((y, index) => ({ y, index }))
  order.sort((left, right) => left.y - right.y || left.index - right.index)
  const placed: number[] = []
  let cursor = labelTop
  for (const item of order) {
    const next = Math.max(item.y, cursor)
    placed.push(next)
    cursor = next + gap
  }
  const last = placed[count - 1] ?? labelBottom
  if (last > labelBottom) {
    const shift = last - labelBottom
    for (let index = 0; index < placed.length; index += 1) {
      placed[index] = (placed[index] ?? labelBottom) - shift
    }
  }
  const first = placed[0] ?? labelTop
  if (first < labelTop) {
    cursor = labelTop
    for (let index = 0; index < placed.length; index += 1) {
      placed[index] = cursor
      cursor += gap
    }
  }
  const result = Array.from({ length: count }, () => labelTop)
  for (let index = 0; index < order.length; index += 1) {
    const item = order[index]
    const y = placed[index]
    if (item !== undefined && y !== undefined) {
      result[item.index] = y
    }
  }
  return result
}

export function priceTicks(lower: number, upper: number): number[] {
  const intervals = 10
  if (upper <= lower) {
    return [lower]
  }
  const step = (upper - lower) / intervals
  const ticks: number[] = []
  for (let index = 0; index <= intervals; index += 1) {
    ticks.push(index === intervals ? upper : lower + step * index)
  }
  return ticks
}

export function mapX(x: number, scale: number): number {
  if (x <= plotRight) {
    return plotLeft + (x - plotLeft) * scale
  }
  return x + plotSpan * (scale - 1)
}

export function unmapX(x: number, scale: number): number {
  const shifted = plotLeft + plotSpan * scale
  if (x <= shifted) {
    return plotLeft + (x - plotLeft) / scale
  }
  return x - plotSpan * (scale - 1)
}
