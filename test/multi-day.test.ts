import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type PriceSeries, type Snapshot } from "../src/present.ts"

const code = "華碩 DUAL-RTX4070-O12G"

function presentCode(series: PriceSeries) {
  return present(series, [{ type: "select", code }])
}

function seriesOf(quotes: { date: string; sellingPrice: number }[]) {
  return [{ code, quotes }]
}

function vgaSnapshot(capturedAt: string, price: number): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>共有商品 1 樣</option>
            <optgroup label="NVIDIA RTX4070">
              <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $${price}</option>
            </optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

describe("多日價格序列與更新", () => {
  test("連續兩天都有日報價時兩筆日報價照日曆順序排", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-16T02:00:00.000Z", 17990),
      vgaSnapshot("2024-06-15T02:00:00.000Z", 18990),
    ])

    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2024-06-15", sellingPrice: 18990 },
      { date: "2024-06-16", sellingPrice: 17990 },
    ]))
  })

  test("對已併入的快照再跑更新不會產生第二筆同一天的日報價", () => {
    const snapshot = vgaSnapshot("2024-06-15T02:00:00.000Z", 18990)
    const series = update(update(emptySeries(), [snapshot]), [snapshot])

    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2024-06-15", sellingPrice: 18990 },
    ]))
  })

  test("同一天較晚的快照改寫售價，較早的快照不會覆蓋較晚的", () => {
    const earlier = vgaSnapshot("2024-06-14T18:00:00.000Z", 18990)
    const later = vgaSnapshot("2024-06-15T10:00:00.000Z", 17990)
    const series = update(update(update(emptySeries(), [earlier]), [later]), [earlier])

    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2024-06-15", sellingPrice: 17990 },
    ]))
  })

  test("抓取失敗的快照不會寫入售價", () => {
    const failed: Snapshot = {
      capturedAt: "2024-06-15T10:00:00.000Z",
      html: "<html><title>Wayback Machine</title><p>Got an HTTP 503 response</p></html>",
    }
    const series = update(update(emptySeries(), [
      vgaSnapshot("2024-06-14T18:00:00.000Z", 18990),
    ]), [failed])

    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2024-06-15", sellingPrice: 18990 },
    ]))
  })

  test("2020-01-01（台北）之前的快照不會產生日報價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2019-12-31T15:59:59.000Z", 18990),
    ])

    expect(presentCode(series).series).toEqual([])
  })

  test("台北時間剛進入 2020-01-01 的快照會產生日報價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2019-12-31T16:00:00.000Z", 18990),
    ])

    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2020-01-01", sellingPrice: 18990 },
    ]))
  })

  test("顯示卡以外的選單不會產生日報價", () => {
    const series = update(emptySeries(), [
      {
        capturedAt: "2024-06-15T02:00:00.000Z",
        html: `
          <tr>
            <td>處理器CPU</td>
            <td>
              <select name="n1">
                <option>｛Intel i9-14900K｝, $20990</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>顯示卡VGA</td>
            <td>
              <select name="n12">
                <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
              </select>
            </td>
          </tr>
        `,
      },
    ])
    const cpu = present(series, [{ type: "select", code: "Intel i9-14900K" }])

    expect(cpu.selected).toEqual([])
    expect(cpu.series).toEqual([])
    expect(presentCode(series).series).toEqual(seriesOf([
      { date: "2024-06-15", sellingPrice: 18990 },
    ]))
  })
})
