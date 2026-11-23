import type { PriceQuoteMark, PriceSeriesLine } from "./marks.ts"

/** Drop intermediate points on weak / narrow viewports to keep SVG DOM small. */
export function thinSeries(
  series: readonly PriceSeriesLine[],
  maxPointsPerLine: number,
): PriceSeriesLine[] {
  if (maxPointsPerLine < 3) {
    return series.map((line) => line)
  }
  return series.map((line) => {
    if (line.quotes.length <= maxPointsPerLine) {
      return line
    }
    const kept: PriceQuoteMark[] = []
    const lastIndex = line.quotes.length - 1
    const step = lastIndex / (maxPointsPerLine - 1)
    const seen = new Set<number>()
    for (let slot = 0; slot < maxPointsPerLine; slot += 1) {
      const index = slot === maxPointsPerLine - 1 ? lastIndex : Math.round(slot * step)
      if (seen.has(index)) {
        continue
      }
      seen.add(index)
      const quote = line.quotes[index]
      if (quote !== undefined) {
        kept.push(quote)
      }
    }
    return { ...line, quotes: kept }
  })
}

export function maxPointsForViewport(width: number): number {
  if (width < 480) {
    return 80
  }
  if (width < 768) {
    return 160
  }
  return Number.POSITIVE_INFINITY
}
