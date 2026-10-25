import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"

function vgaSnapshot(capturedAt: string, groups: readonly { label: string; rows: readonly string[] }[]): Snapshot {
  const body = groups.map((group) => {
    const options = group.rows.map((row) => `<option>${row}</option>`).join("")
    return `<optgroup label="${group.label}">${options}</optgroup>`
  }).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            ${body}
          </select>
        </td>
      </tr>
    `,
  }
}

const dual = "華碩 DUAL-RTX4070-O12G"
const rtx4060 = "華碩 RTX4060"

describe("已選、金額軸與讀數", () => {
  test("換晶片分組、關鍵字或查詢區間後，已選仍在圖上", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "setChipGroup", name: "RTX 4060" },
      { type: "setKeyword", text: "RTX4060" },
      { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
    ])

    expect(view.selected).toEqual([dual])
    expect(view.series).toEqual([
      { code: dual, quotes: [{ date: "2024-06-15", sellingPrice: 18990 }] },
    ])
  })

  test("不同晶片分組的報價列可以同時在已選裡", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "select", code: rtx4060 },
    ])

    expect(view.selected).toEqual([dual, rtx4060])
    expect(view.series.map((item) => item.code)).toEqual([dual, rtx4060])
  })

  test("已選達到 8 條時不能再加，拿掉一條之後可以再加", () => {
    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: codes.map((code, index) => `｛${code}｝, $${1000 + index}`),
        },
      ]),
    ])
    const capped = present(series, codes.map((code) => ({ type: "select" as const, code })))
    expect(capped.selected).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"])

    const reopened = present(series, [
      ...codes.map((code) => ({ type: "select" as const, code })),
      { type: "deselect", code: "A" },
      { type: "select", code: "I" },
    ])
    expect(reopened.selected).toEqual(["B", "C", "D", "E", "F", "G", "H", "I"])
    expect(reopened.series.map((item) => item.code)).toEqual(["B", "C", "D", "E", "F", "G", "H", "I"])
  })

  test("從已選拿掉後，該價格序列離開圖", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "select", code: rtx4060 },
      { type: "deselect", code: dual },
    ])

    expect(view.selected).toEqual([rtx4060])
    expect(view.series).toEqual([
      { code: rtx4060, quotes: [{ date: "2024-06-15", sellingPrice: 9000 }] },
    ])
  })

  test("多條已選共用一個金額軸，下緣低於最低售價、上緣高於最高售價，且不包含 0", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "select", code: rtx4060 },
    ])

    expect(view.axis).not.toBeNull()
    if (view.axis === null) {
      return
    }
    expect(view.axis.lower).toBeGreaterThan(0)
    expect(view.axis.lower).toBeLessThan(9000)
    expect(view.axis.upper).toBeGreaterThan(18990)
  })

  test("只有一個售價時，金額軸兩端仍不貼著那個售價，也不包含 0", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
      ]),
    ])
    const view = present(series, [{ type: "select", code: dual }])

    expect(view.axis).not.toBeNull()
    if (view.axis === null) {
      return
    }
    expect(view.axis.lower).toBeGreaterThan(0)
    expect(view.axis.lower).toBeLessThan(18990)
    expect(view.axis.upper).toBeGreaterThan(18990)
  })

  test("點到一個點時，讀數是該點的日期、代號與售價，一次只有一筆", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
      vgaSnapshot("2024-06-16T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $17990`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "select", code: rtx4060 },
      { type: "point", date: "2024-06-15", code: dual },
      { type: "point", date: "2024-06-16", code: dual },
    ])

    expect(view.readout).toEqual({ date: "2024-06-16", code: dual, sellingPrice: 17990 })
  })

  test("點在缺日上時，讀數是同一條價格序列上最接近的那個點", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $18990`] },
        { label: "RTX 4060", rows: [`｛${rtx4060}｝, $9000`] },
      ]),
      vgaSnapshot("2024-06-20T02:00:00.000Z", [
        { label: "RTX 4070", rows: [`｛${dual}｝, $17000`] },
      ]),
    ])
    const view = present(series, [
      { type: "select", code: dual },
      { type: "select", code: rtx4060 },
      { type: "point", date: "2024-06-16", code: dual },
    ])

    expect(view.readout).toEqual({ date: "2024-06-15", code: dual, sellingPrice: 18990 })
  })
})
