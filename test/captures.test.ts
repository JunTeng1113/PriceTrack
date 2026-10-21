import { describe, expect, test } from "vitest"
import { chooseCaptures, type CaptureRow } from "../src/captures.ts"

const range = { start: "2020-01-01", end: "2026-10-21" }

function row(timestamp: string, original: string, status = "200"): CaptureRow {
  return { timestamp, original, status }
}

describe("Wayback 快照選擇", () => {
  test("只有 http、沒有 www 的估價頁也會被收進來", () => {
    const chosen = chooseCaptures([
      row("20200105120219", "http://coolpc.com.tw/evaluate.php"),
    ], range)

    expect(chosen).toEqual([
      {
        timestamp: "20200105120219",
        original: "http://coolpc.com.tw/evaluate.php",
        capturedAt: "2020-01-05T12:02:19.000Z",
        date: "2020-01-05",
      },
    ])
  })

  test("同一台北日有多種網址時只留最晚一份", () => {
    const chosen = chooseCaptures([
      row("20200105020000", "http://coolpc.com.tw/evaluate.php"),
      row("20200105120000", "https://www.coolpc.com.tw/evaluate.php"),
      row("20200106030000", "https://coolpc.com.tw/evaluate.php"),
    ], range)

    expect(chosen.map((capture) => capture.timestamp)).toEqual([
      "20200105120000",
      "20200106030000",
    ])
  })

  test("台北時間 2020-01-01 之前與 2026-10-21 之後不收", () => {
    const chosen = chooseCaptures([
      row("20191231155959", "https://www.coolpc.com.tw/evaluate.php"),
      row("20191231160000", "https://www.coolpc.com.tw/evaluate.php"),
      row("20261021155959", "https://www.coolpc.com.tw/evaluate.php"),
      row("20261021160000", "https://www.coolpc.com.tw/evaluate.php"),
    ], range)

    expect(chosen.map((capture) => capture.date)).toEqual(["2020-01-01", "2026-10-21"])
  })

  test("失敗狀態與估價頁以外的網址不收", () => {
    const chosen = chooseCaptures([
      row("20200105120219", "https://www.coolpc.com.tw/evaluate.php", "503"),
      row("20200107120219", "https://www.coolpc.com.tw/price.php"),
    ], range)

    expect(chosen).toEqual([])
  })
})
