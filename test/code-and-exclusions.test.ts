import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"

const capturedAt = "2024-06-15T02:00:00.000Z"

function vgaSnapshot(options: string): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>共有商品 2 樣</option>
            ${options}
          </select>
        </td>
      </tr>
    `,
  }
}

describe("代號與排除", () => {
  test("晶片分組名稱含周邊的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA / AMD 顯示卡周邊配件">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("晶片分組名稱含配件的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="顯示卡配件">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("晶片分組名稱含支架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="顯卡支架">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("代號含支架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 顯卡支架｝氣泡水平儀, $1290</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "顯卡支架" }])

    expect(view.candidates).toEqual([])
  })
})
