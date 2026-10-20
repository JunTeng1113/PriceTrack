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

  test("代號含支撐架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 顯卡支撐架｝氣泡水平儀, $1290</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "支撐架" }])

    expect(view.candidates).toEqual([])
  })

  test("只有開頭｛的代號取到第一個半形括號之前", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5060Ti">
          <option>｛技嘉 RTX5060Ti WINDFORCE OC 16G(2587MHz/28cm/三風扇), $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "windforce" }])

    expect(view.candidates).toEqual(["技嘉 RTX5060Ti WINDFORCE OC 16G"])
  })

  test("代號兩端空白不構成另一個報價列", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛ 華碩 DUAL-RTX4070-O12G ｝2535MHz, $20990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "DUAL-RTX4070" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("只有括號外文字不同的列在候選清單裡是同一個代號", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝三年保固, $20990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "DUAL-RTX4070" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("代號不同的列可以分別加入已選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
          <option>｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz, $19990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G-WHITE" },
    ])

    expect(view.selected).toEqual([
      "華碩 DUAL-RTX4070-O12G",
      "華碩 DUAL-RTX4070-O12G-WHITE",
    ])
  })

  test("沒有｛的列和沒有金額的統計列不出現在候選清單", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>共有商品 12 樣，最低 $9900</option>
          <option>♥ 熱賣 顯示卡下殺 $18990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const ads = present(series, [{ type: "setKeyword", text: "熱賣" }])
    const summary = present(series, [{ type: "setKeyword", text: "共有商品" }])

    expect(ads.candidates).toEqual([])
    expect(summary.candidates).toEqual([])
  })

  test("工作站繪圖卡與外接式顯示卡可以找到並加入已選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA 工作站繪圖卡">
          <option>｛麗臺 RTX A5000｝24G, $42990</option>
        </optgroup>
        <optgroup label="外接式顯示卡">
          <option>｛技嘉 AORUS RTX3080 Gaming Box｝外接盒, $32990</option>
        </optgroup>
      `),
    ])
    const workstation = present(series, [{ type: "setKeyword", text: "A5000" }])
    const external = present(series, [{ type: "setKeyword", text: "gaming box" }])
    const selected = present(series, [
      { type: "select", code: "麗臺 RTX A5000" },
      { type: "select", code: "技嘉 AORUS RTX3080 Gaming Box" },
    ])

    expect(workstation.candidates).toEqual(["麗臺 RTX A5000"])
    expect(external.candidates).toEqual(["技嘉 AORUS RTX3080 Gaming Box"])
    expect(selected.selected).toEqual([
      "麗臺 RTX A5000",
      "技嘉 AORUS RTX3080 Gaming Box",
    ])
  })
})
