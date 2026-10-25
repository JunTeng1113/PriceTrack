import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"

const capturedAt = "2024-06-15T02:00:00.000Z"

function vgaSnapshot(options: string, at = capturedAt): Snapshot {
  return {
    capturedAt: at,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>共有商品 2 樣</option>
            <optgroup label="NVIDIA RTX4070">
              ${options}
            </optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

describe("售價與日報價", () => {
  test("有↘的列圖上的金額是箭頭右側", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $20990↘$18990</option>`),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990 }],
      },
    ])
  })

  test("不能選但仍印著金額的列加入已選後圖上有那個售價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`<option disabled>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990 }],
      },
    ])
  })

  test("列上同時有酷幣時售價不扣除酷幣", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`<option>｛華碩 DUAL-RTX4070-O12G｝$59900↘$49999 ◆ ↓酷幣5000↓</option>`),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 49999 }],
      },
    ])
  })

  test("沒有↘但有兩個金額的列圖上的金額是最後一個", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`<option>｛華碩 DUAL-RTX4070-O12G｝原價$3190, $2790</option>`),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 2790 }],
      },
    ])
  })

  test("同一個代號同一天有兩個售價時日報價取較低者", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $20990</option>
        <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990 }],
      },
    ])
  })

  test("同一份快照有一般價也有裝機價時日報價是一般價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <option>裝機價｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $20990</option>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 20990 }],
      },
    ])
  })

  test("只有裝機價或寫著售罄時仍有日報價，並標成虛線", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <option>裝機價｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        <option>｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz 售罄！, $19990</option>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G-WHITE" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990, dashed: true }],
      },
      {
        code: "華碩 DUAL-RTX4070-O12G-WHITE",
        quotes: [{ date: "2024-06-15", sellingPrice: 19990, dashed: true }],
      },
    ])
  })

  test("同一天較晚的快照只剩裝機價時日報價改為裝機價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $20990</option>`,
        "2024-06-15T02:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>裝機價｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`,
        "2024-06-15T08:00:00.000Z",
      ),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990, dashed: true }],
      },
    ])
  })

  test("UTC 快照落在台北時間的哪一天點就在那一天", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`,
        "2024-06-14T16:00:00.000Z",
      ),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 18990 }],
      },
    ])
  })

  test("限搭機與組裝價視同裝機價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <option>限搭機｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $20990</option>
        <option>組裝價｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz, $19990</option>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G-WHITE" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [{ date: "2024-06-15", sellingPrice: 20990 }],
      },
      {
        code: "華碩 DUAL-RTX4070-O12G-WHITE",
        quotes: [{ date: "2024-06-15", sellingPrice: 19990, dashed: true }],
      },
    ])
  })

  test("前後都有出現而中間的快照沒有這個代號時，中間的日子用前一次的售價並標成下架", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`,
        "2024-06-15T02:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz, $19990</option>`,
        "2024-06-16T02:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990</option>`,
        "2024-06-17T02:00:00.000Z",
      ),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [
          { date: "2024-06-15", sellingPrice: 18990 },
          { date: "2024-06-16", sellingPrice: 18990, dashed: true, delisted: true },
          { date: "2024-06-17", sellingPrice: 17990 },
        ],
      },
    ])
  })

  test("下架只補有快照的日子", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`,
        "2024-06-15T02:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz, $19990</option>`,
        "2024-06-17T02:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990</option>`,
        "2024-06-19T02:00:00.000Z",
      ),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX4070-O12G",
        quotes: [
          { date: "2024-06-15", sellingPrice: 18990 },
          { date: "2024-06-17", sellingPrice: 18990, dashed: true, delisted: true },
          { date: "2024-06-19", sellingPrice: 17990 },
        ],
      },
    ])
  })

  test("同一天有多份快照時日報價是最晚一份的售價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $17990</option>`,
        "2024-06-14T18:00:00.000Z",
      ),
      vgaSnapshot(
        `<option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>`,
        "2024-06-15T10:00:00.000Z",
      ),
    ])
    const view = present(series, [
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
