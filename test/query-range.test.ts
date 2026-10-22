import { describe, expect, test } from "vitest"
import { emptySeries, present, taipeiToday, update, type Snapshot } from "../src/present.ts"

function vgaSnapshot(capturedAt: string): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>共有商品 1 樣</option>
            <optgroup label="NVIDIA RTX4070">
              <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
            </optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

describe("查詢區間", () => {
  test("打開頁面時起日是 2020-01-01，迄日是台北今天", () => {
    const series = update(emptySeries(), [vgaSnapshot("2024-02-29T02:00:00.000Z")])
    const view = present(series, [])

    expect(view.queryRange).toEqual({ start: "2020-01-01", end: taipeiToday() })
  })

  test("改了查詢區間之後已選還在", () => {
    const series = update(emptySeries(), [vgaSnapshot("2024-06-15T02:00:00.000Z")])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "setRange", start: "2024-01-01", end: "2024-06-15" },
    ])

    expect(view.selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(view.queryRange).toEqual({ start: "2024-01-01", end: "2024-06-15" })
  })

  test("已選的報價列在新區間沒有日報價時圖上沒有點，代號仍留在已選", () => {
    const series = update(emptySeries(), [vgaSnapshot("2024-06-15T02:00:00.000Z")])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "setRange", start: "2023-01-01", end: "2023-02-01" },
    ])

    expect(view.selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(view.series).toEqual([
      { code: "華碩 DUAL-RTX4070-O12G", quotes: [] },
    ])
  })
})
