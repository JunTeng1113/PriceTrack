import { expect, test } from "vitest"
import { buildPriceMarks } from "../src/chart/marks.ts"
import { thinSeries } from "../src/chart/thin.ts"

test("buildPriceMarks 產出 frame 與點線標記", () => {
  const marks = buildPriceMarks(
    [
      {
        code: "華碩 DEMO",
        colorIndex: 0,
        quotes: [
          { date: "2024-06-15", sellingPrice: 10000 },
          { date: "2024-06-16", sellingPrice: 11000 },
        ],
      },
    ],
    { lower: 9000, upper: 12000 },
    true,
  )
  expect(marks.some((mark) => mark.kind === "frame")).toBe(true)
  expect(marks.some((mark) => mark.kind === "point")).toBe(true)
  expect(marks.some((mark) => mark.kind === "segment" && mark.hit)).toBe(true)
  expect(marks.some((mark) => mark.kind === "label" && mark.code === "華碩 DEMO")).toBe(true)
})

test("thinSeries 限制每條線點數", () => {
  const quotes = Array.from({ length: 100 }, (_, index) => ({
    date: `2024-01-${String((index % 28) + 1).padStart(2, "0")}`,
    sellingPrice: 10000 + index,
  }))
  const thinned = thinSeries([{ code: "A", quotes }], 10)
  expect(thinned[0]?.quotes.length).toBeLessThanOrEqual(10)
  expect(thinned[0]?.quotes[0]?.sellingPrice).toBe(10000)
  expect(thinned[0]?.quotes.at(-1)?.sellingPrice).toBe(10099)
})
