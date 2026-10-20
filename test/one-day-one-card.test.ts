import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"

const snapshot: Snapshot = {
  capturedAt: "2024-06-15T02:00:00.000Z",
  html: `
    <tr>
      <td>顯示卡VGA</td>
      <td>
        <select name="n12">
          <option>共有商品 1 樣</option>
          <optgroup label="NVIDIA RTX4070">
            <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz/24cm/雙風扇, $18990</option>
          </optgroup>
        </select>
      </td>
    </tr>
  `,
}

describe("單日單卡上圖", () => {
  test("打開頁面時圖上沒有價格序列", () => {
    const series = update(emptySeries(), [snapshot])
    const view = present(series, [])

    expect(view.series).toEqual([])
    expect(view.selected).toEqual([])
  })

  test("關鍵字找出的候選只顯示代號", () => {
    const series = update(emptySeries(), [snapshot])
    const view = present(series, [{ type: "setKeyword", text: "dual-rtx4070" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("已選的報價列在圖上顯示該台北日的售價", () => {
    const series = update(emptySeries(), [snapshot])
    const view = present(series, [
      { type: "setKeyword", text: "DUAL-RTX4070" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990 }],
      },
    ])
  })
})
