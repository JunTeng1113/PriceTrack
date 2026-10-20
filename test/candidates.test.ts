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

describe("篩選候選", () => {
  test("未選晶片分組且關鍵字是空的時候，候選清單是空的", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "NVIDIA RTX4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
      ]),
    ])
    const view = present(series, [])

    expect(view.candidates).toEqual([])
  })

  test("分組清單只含查詢區間內至少出現過一次的名稱", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-01-15T02:00:00.000Z", [
        {
          label: "舊分組",
          rows: ["｛華碩 舊卡｝, $10000"],
        },
      ]),
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "NVIDIA RTX4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
    ])

    expect(view.chipGroups).toEqual(["NVIDIA RTX4070"])
  })

  test("「RTX 4070」與「RTX4070」是兩個分組", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
        {
          label: "RTX4070",
          rows: ["｛技嘉 RTX4070 WINDFORCE｝, $17990"],
        },
      ]),
    ])
    const view = present(series, [])

    expect(view.chipGroups).toEqual(["RTX 4070", "RTX4070"])
  })

  test("分組順序跟區間內最晚快照由上到下一致，更早才有的名稱依碼位接在後面", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "舊分組",
          rows: ["｛華碩 舊卡｝, $10000"],
        },
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
        {
          label: "AMD",
          rows: ["｛技嘉 AORUS｝, $20000"],
        },
      ]),
      vgaSnapshot("2024-06-16T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990"],
        },
        {
          label: "RTX 4060",
          rows: ["｛華碩 RTX4060｝, $9000"],
        },
      ]),
    ])
    const view = present(series, [])

    expect(view.chipGroups).toEqual(["RTX 4070", "RTX 4060", "AMD", "舊分組"])
  })

  test("同一天較晚的快照改了由上到下的順序時，分組清單跟那份走", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝, $18990"],
        },
      ]),
      vgaSnapshot("2024-06-15T10:00:00.000Z", [
        {
          label: "RTX 4060",
          rows: ["｛華碩 RTX4060｝, $9000"],
        },
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝, $17990"],
        },
      ]),
    ])
    const view = present(series, [])

    expect(view.chipGroups).toEqual(["RTX 4060", "RTX 4070"])
  })

  test("選了分組後，候選是區間內至少有一天落在該名稱下的報價列", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-01-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛只在一月｝, $10000"],
        },
      ]),
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
        {
          label: "RTX 4060",
          rows: ["｛華碩 RTX4060｝, $9000"],
        },
      ]),
      vgaSnapshot("2024-06-16T02:00:00.000Z", [
        {
          label: "RTX 4060",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990"],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
      { type: "setChipGroup", name: "RTX 4070" },
    ])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("報價列在區間內換過晶片分組時，圖上仍包含那些日子的日報價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990"],
        },
      ]),
      vgaSnapshot("2024-06-16T02:00:00.000Z", [
        {
          label: "RTX 4060",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990"],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setChipGroup", name: "RTX 4070" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [
          { date: "2024-06-15", sellingPrice: 18990 },
          { date: "2024-06-16", sellingPrice: 17990 },
        ],
      },
    ])
  })

  test("關鍵字 5060ti 對得上代號裡的 RTX5060TI", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 5060 Ti",
          rows: ["｛技嘉 RTX5060TI WINDFORCE OC 16G｝2587MHz, $12990"],
        },
      ]),
    ])
    const view = present(series, [{ type: "setKeyword", text: "5060ti" }])

    expect(view.candidates).toEqual(["技嘉 RTX5060TI WINDFORCE OC 16G"])
  })

  test("關鍵字對得上區間內最後一次出現的整段列文字，找得到括號外的限搭機", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz/限搭機, $18990"],
        },
      ]),
    ])
    const view = present(series, [{ type: "setKeyword", text: "限搭機" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("只出現在更早快照的熱賣或下殺到某日，不會讓報價列被搜出來", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝熱賣下殺到6/30, $18990"],
        },
      ]),
      vgaSnapshot("2024-06-16T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990"],
        },
      ]),
    ])
    const hot = present(series, [{ type: "setKeyword", text: "熱賣" }])
    const countdown = present(series, [{ type: "setKeyword", text: "下殺到6/30" }])

    expect(hot.candidates).toEqual([])
    expect(countdown.candidates).toEqual([])
  })

  test("分組與關鍵字都有填時，候選必須同時符合", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: [
            "｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990",
            "｛技嘉 RTX4070 WINDFORCE｝, $17990",
          ],
        },
        {
          label: "RTX 4060",
          rows: ["｛華碩 RTX4060｝限搭機, $9000"],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setChipGroup", name: "RTX 4070" },
      { type: "setKeyword", text: "限搭機" },
    ])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("只填關鍵字時，搜尋區間內全部報價列", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-01-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛只在一月｝限搭機, $10000"],
        },
      ]),
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990"],
        },
        {
          label: "RTX 4060",
          rows: [
            "｛華碩 RTX4060｝限搭機, $9000",
            "｛技嘉 無此字｝, $8000",
          ],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
      { type: "setKeyword", text: "限搭機" },
    ])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G", "華碩 RTX4060"])
  })

  test("候選清單依代號的 Unicode 碼位由小到大排，英數開頭排在中文開頭前面", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: [
            "｛華碩 DUAL-RTX4070-O12G｝, $18990",
            "｛ASUS TUF-RTX4070｝, $19990",
            "｛技嘉 RTX4070 WINDFORCE｝, $17990",
          ],
        },
      ]),
    ])
    const view = present(series, [{ type: "setChipGroup", name: "RTX 4070" }])

    expect(view.candidates).toEqual([
      "ASUS TUF-RTX4070",
      "技嘉 RTX4070 WINDFORCE",
      "華碩 DUAL-RTX4070-O12G",
    ])
  })

  test("候選清單與圖例只顯示代號", () => {
    const series = update(emptySeries(), [
      vgaSnapshot("2024-06-15T02:00:00.000Z", [
        {
          label: "RTX 4070",
          rows: ["｛華碩 DUAL-RTX4070-O12G｝2535MHz/限搭機, $18990"],
        },
      ]),
    ])
    const view = present(series, [
      { type: "setKeyword", text: "限搭機" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(view.selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })
})
