// @vitest-environment happy-dom

import { describe, expect, test } from "vitest"
import { renderPage } from "../src/page.ts"
import { emptySeries, update, type Snapshot } from "../src/present.ts"

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

function documentOf(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

function sectionByHeading(doc: Document, heading: string): HTMLElement | null {
  const headings = [...doc.querySelectorAll("h2")]
  const found = headings.find((node) => node.textContent === heading)
  if (found === undefined || found.parentElement === null) {
    return null
  }
  return found.parentElement
}

describe("單日單卡頁面", () => {
  test("打開頁面時圖上沒有價格序列", () => {
    const series = update(emptySeries(), [snapshot])
    const chart = sectionByHeading(documentOf(renderPage(series, [])), "價格序列")

    expect(chart).not.toBeNull()
    expect(chart?.textContent).not.toContain("18990")
    expect(chart?.textContent).not.toContain("華碩 DUAL-RTX4070-O12G")
  })

  test("關鍵字是 shadcn 輸入欄", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [{ type: "setKeyword", text: "dual" }]))
    const input = doc.querySelector('input[aria-label="關鍵字"]')

    expect(input?.getAttribute("data-slot")).toBe("input")
    expect(input?.getAttribute("value")).toBe("dual")
  })

  test("介面文字為繁體中文", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.documentElement.lang).toBe("zh-Hant")
    expect(doc.body.textContent).toContain("關鍵字")
    expect(doc.body.textContent).toContain("已選")
    expect(doc.body.textContent).toContain("價格序列")
  })

  test("候選和拿掉是 shadcn 按鈕", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [
      { type: "setKeyword", text: "DUAL" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ]))
    const candidate = doc.querySelector('[aria-label="候選"] button')
    const remove = doc.querySelector('[aria-label="已選"] button')

    expect(candidate?.getAttribute("data-slot")).toBe("button")
    expect(candidate?.textContent).toBe("華碩 DUAL-RTX4070-O12G")
    expect(remove?.getAttribute("data-slot")).toBe("button")
    expect(remove?.textContent).toBe("拿掉")
    expect(remove?.getAttribute("data-code")).toBe("華碩 DUAL-RTX4070-O12G")
  })

  test("用代號的一部分當關鍵字，候選清單只顯示代號", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [{ type: "setKeyword", text: "dual-rtx4070" }]))
    const list = doc.querySelector('[aria-label="候選"]')
    const items = [...(list?.querySelectorAll("li") ?? [])].map((item) => item.textContent)

    expect(items).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("加入已選後圖上有該台北日的售價", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [
      { type: "setKeyword", text: "DUAL-RTX4070" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ]))
    const selected = [...(doc.querySelector('[aria-label="已選"]')?.querySelectorAll("li span") ?? [])]
      .map((item) => item.textContent)
    const points = [...(doc.querySelector('[aria-label="價格點"]')?.querySelectorAll("li") ?? [])]

    expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(points).toHaveLength(1)
    expect(points[0]?.textContent).toContain("2024-06-15")
    expect(points[0]?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
    expect(points[0]?.textContent).toContain("18990")
  })

  test("起日和迄日仍是日期欄位", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.querySelector('input[aria-label="起日"]')?.getAttribute("type")).toBe("date")
    expect(doc.querySelector('input[aria-label="迄日"]')?.getAttribute("type")).toBe("date")
  })

  test("篩選用 Tailwind 直向間距排在價格序列上方", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))
    const filter = sectionByHeading(doc, "篩選")
    const chart = sectionByHeading(doc, "價格序列")

    expect(filter?.classList.contains("flex")).toBe(true)
    expect(filter?.classList.contains("flex-col")).toBe(true)
    expect(filter?.classList.contains("gap-3")).toBe(true)
    expect(filter).not.toBeNull()
    expect(chart).not.toBeNull()
    if (filter !== null && chart !== null) {
      expect(filter.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  test("窄螢幕時篩選在圖的上方", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))
    const filter = sectionByHeading(doc, "篩選")
    const chart = sectionByHeading(doc, "價格序列")

    expect(filter).not.toBeNull()
    expect(chart).not.toBeNull()
    if (filter !== null && chart !== null) {
      expect(filter.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  test("瀏覽時不連 Wayback", () => {
    const series = update(emptySeries(), [snapshot])
    const html = renderPage(series, [{ type: "select", code: "華碩 DUAL-RTX4070-O12G" }])

    expect(html.toLowerCase()).not.toContain("archive.org")
    expect(html.toLowerCase()).not.toContain("wayback")
  })
})

const code = "華碩 DUAL-RTX4070-O12G"

function pricedSnapshot(capturedAt: string, price: number): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>｛${code}｝2535MHz, $${price}</option>
          </select>
        </td>
      </tr>
    `,
  }
}

function regionTexts(doc: Document, label: string): string[] {
  const region = doc.querySelector(`[aria-label="${label}"]`)
  return [...(region?.querySelectorAll("span") ?? [])].map((node) => node.textContent ?? "")
}

describe("多日走勢", () => {
  test("等距的日期與售價，中間的日報價落在兩端正中間", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 10000),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 20000),
      pricedSnapshot("2024-06-17T02:00:00.000Z", 30000),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const points = [...doc.querySelectorAll('[aria-label="折線圖"] [data-date]')].map((node) => ({
      date: node.getAttribute("data-date"),
      price: node.getAttribute("data-price"),
      x: Number(node.getAttribute("cx")),
      y: Number(node.getAttribute("cy")),
    }))
    const [first, middle, last] = points

    expect(points.map((point) => [point.date, point.price])).toEqual([
      ["2024-06-15", "10000"],
      ["2024-06-16", "20000"],
      ["2024-06-17", "30000"],
    ])
    expect(first?.x).toBe(0)
    expect(middle?.x).toBe(50)
    expect(last?.x).toBe(100)
    expect(middle?.y).toBeCloseTo(((first?.y ?? 0) + (last?.y ?? 0)) / 2)
    expect(last?.y ?? 0).toBeLessThan(first?.y ?? 0)
  })

  test("連續有日報價的日子在圖上以線相連", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 17990),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const chart = doc.querySelector('[aria-label="折線圖"]')
    const points = [...(chart?.querySelectorAll("[data-date]") ?? [])].map((node) => ({
      x: Number(node.getAttribute("cx")),
      y: Number(node.getAttribute("cy")),
    }))
    const lines = [...(chart?.querySelectorAll("line") ?? [])].map((node) => ({
      x1: Number(node.getAttribute("x1")),
      y1: Number(node.getAttribute("y1")),
      x2: Number(node.getAttribute("x2")),
      y2: Number(node.getAttribute("y2")),
    }))

    expect(lines).toEqual([
      { x1: points[0]?.x, y1: points[0]?.y, x2: points[1]?.x, y2: points[1]?.y },
    ])
  })

  test("連續有日報價的日子以折線相連，日期軸照日曆順序排", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-16T02:00:00.000Z", 17990),
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))

    expect(regionTexts(doc, "日期軸")).toEqual(["2024-06-15", "2024-06-16"])
    expect(regionTexts(doc, "折線")).toEqual(["2024-06-15 2024-06-16"])
  })

  test("缺日仍佔時間軸，兩天的間隔是一天的兩倍", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 10000),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 10000),
      pricedSnapshot("2024-06-18T02:00:00.000Z", 10000),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const xs = [...doc.querySelectorAll('[aria-label="折線圖"] [data-date]')].map((node) =>
      Number(node.getAttribute("cx")),
    )
    const [first, second, third] = xs

    expect(((second ?? 0) - (first ?? 0)) * 2).toBeCloseTo((third ?? 0) - (second ?? 0))
  })

  test("中間缺一天時圖上的線斷開，該日沒有售價", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-06-17T02:00:00.000Z", 16990),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const chart = doc.querySelector('[aria-label="折線圖"]')
    const dates = [...(chart?.querySelectorAll("[data-date]") ?? [])].map((node) => node.getAttribute("data-date"))

    expect(dates).toEqual(["2024-06-15", "2024-06-17"])
    expect(chart?.querySelectorAll("line")).toHaveLength(0)
  })

  test("中間缺一天時線斷開，該日仍在日期軸上且沒有售價", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-06-17T02:00:00.000Z", 16990),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const pointText = [...doc.querySelectorAll("li")].map((item) => item.textContent ?? "").join("\n")

    expect(regionTexts(doc, "日期軸")).toEqual(["2024-06-15", "2024-06-16", "2024-06-17"])
    expect(regionTexts(doc, "折線")).toEqual([])
    expect(pointText).not.toContain("2024-06-16")
    expect(pointText).toContain("18990")
    expect(pointText).toContain("16990")
  })

  test("日報價落在金額軸兩端之內，不貼著軸的邊緣", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 10000),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 30000),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const ys = [...doc.querySelectorAll('[aria-label="折線圖"] [data-date]')].map((node) =>
      Number(node.getAttribute("cy")),
    )

    expect(ys.every((y) => y > 0 && y < 100)).toBe(true)
  })

  test("沒有已選時折線圖沒有線也沒有點", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 17990),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector('[aria-label="折線圖"]')

    expect(chart?.querySelectorAll("line")).toHaveLength(0)
    expect(chart?.querySelectorAll("[data-date]")).toHaveLength(0)
  })

  test("查詢區間改短後，折線圖只留區間內的日報價", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-06-16T02:00:00.000Z", 17990),
      pricedSnapshot("2024-06-17T02:00:00.000Z", 16990),
    ])
    const doc = documentOf(renderPage(series, [
      { type: "select", code },
      { type: "setRange", start: "2024-06-16", end: "2024-06-17" },
    ]))
    const dates = [...doc.querySelectorAll('[aria-label="折線圖"] [data-date]')].map((node) =>
      node.getAttribute("data-date"),
    )

    expect(dates).toEqual(["2024-06-16", "2024-06-17"])
  })

  test("頁面上沒有重新抓取的按鈕", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, [{ type: "select", code }]))
    const buttons = [...doc.querySelectorAll("button")].map((button) => button.textContent)

    expect(buttons).not.toContain("重新抓取")
    expect(doc.body.textContent).not.toContain("重新抓取")
  })
})

function inputValue(doc: Document, label: string): string | null {
  const input = doc.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
  return input === null ? null : input.value
}

describe("查詢區間", () => {
  test("打開頁面時迄日是最新日報價，起日是往前 12 個月的同一日", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe("2024-06-15")
    expect(inputValue(doc, "起日")).toBe("2023-06-15")
  })

  test("改了起日也不能早於 2020-01-01", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [
      { type: "setRange", start: "2019-06-01", end: "2024-06-15" },
    ]))

    expect(inputValue(doc, "起日")).toBe("2020-01-01")
    expect(inputValue(doc, "迄日")).toBe("2024-06-15")
  })

  test("改了查詢區間之後已選還在，區間外的日子圖上沒有點", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "setRange", start: "2023-01-01", end: "2023-02-01" },
    ]))
    const points = [...(doc.querySelector('[aria-label="價格點"]')?.querySelectorAll("li") ?? [])]
    const selected = [...(doc.querySelector('[aria-label="已選"]')?.querySelectorAll("li span") ?? [])]
      .map((item) => item.textContent)

    expect(inputValue(doc, "起日")).toBe("2023-01-01")
    expect(inputValue(doc, "迄日")).toBe("2023-02-01")
    expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(points).toHaveLength(0)
  })

  test("往前 12 個月若該月沒有這一天，起日是該月最後一天", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-02-29T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe("2024-02-29")
    expect(inputValue(doc, "起日")).toBe("2023-02-28")
  })

  test("預設起日不早於 2020-01-01", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2020-06-15T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe("2020-06-15")
    expect(inputValue(doc, "起日")).toBe("2020-01-01")
  })

  test("迄日是多筆日報價裡最新的一天", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-08-01T02:00:00.000Z", 17990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe("2024-08-01")
    expect(inputValue(doc, "起日")).toBe("2023-08-01")
  })

  test("完全沒有日報價時圖是空的", () => {
    const doc = documentOf(renderPage(emptySeries(), []))
    const chart = sectionByHeading(doc, "價格序列")

    expect(inputValue(doc, "起日")).toBe("")
    expect(inputValue(doc, "迄日")).toBe("")
    expect(chart?.querySelector("li")).toBeNull()
    expect(regionTexts(doc, "日期軸")).toEqual([])
  })
})

describe("篩選候選", () => {
  test("晶片分組是 shadcn 下拉，列出區間內的分組", () => {
    const series = update(emptySeries(), [{
      capturedAt: "2024-06-15T02:00:00.000Z",
      html: `
        <tr>
          <td>顯示卡VGA</td>
          <td>
            <select name="n12">
              <optgroup label="RTX 4070">
                <option>｛華碩 DUAL-RTX4070-O12G｝, $18990</option>
              </optgroup>
              <optgroup label="RTX 4060">
                <option>｛華碩 RTX4060｝, $9000</option>
              </optgroup>
            </select>
          </td>
        </tr>
      `,
    }])
    const doc = documentOf(renderPage(series, [{ type: "setChipGroup", name: "RTX 4070" }]))
    const trigger = doc.querySelector('[aria-label="晶片分組"]')
    const items = [...doc.querySelectorAll('[data-slot="select-item"]')].map((item) => item.textContent)

    expect(trigger?.getAttribute("data-slot")).toBe("select-trigger")
    expect(trigger?.textContent).toBe("RTX 4070")
    expect(items).toEqual(["RTX 4070", "RTX 4060"])
  })

  test("分組清單列出區間內的晶片分組，選了之後候選只顯示代號", () => {
    const series = update(emptySeries(), [{
      capturedAt: "2024-06-15T02:00:00.000Z",
      html: `
        <tr>
          <td>顯示卡VGA</td>
          <td>
            <select name="n12">
              <optgroup label="RTX 4070">
                <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz/限搭機, $18990</option>
              </optgroup>
              <optgroup label="RTX 4060">
                <option>｛華碩 RTX4060｝, $9000</option>
              </optgroup>
            </select>
          </td>
        </tr>
      `,
    }])
    const doc = documentOf(renderPage(series, [{ type: "setChipGroup", name: "RTX 4070" }]))
    const groups = [...doc.querySelectorAll('[data-slot="select-item"]')]
      .map((item) => item.textContent ?? "")
    const candidates = [...doc.querySelectorAll('[aria-label="候選"] li')]
      .map((item) => item.textContent)

    expect(groups).toEqual(["RTX 4070", "RTX 4060"])
    expect(candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })
})

describe("已選、金額軸與讀數", () => {
  test("已選可以拿掉，圖上有金額軸與一筆讀數", () => {
    const series = update(emptySeries(), [{
      capturedAt: "2024-06-15T02:00:00.000Z",
      html: `
        <tr>
          <td>顯示卡VGA</td>
          <td>
            <select name="n12">
              <optgroup label="RTX 4070">
                <option>｛華碩 DUAL-RTX4070-O12G｝, $18990</option>
              </optgroup>
              <optgroup label="RTX 4060">
                <option>｛華碩 RTX4060｝, $9000</option>
              </optgroup>
            </select>
          </td>
        </tr>
      `,
    }])
    const doc = documentOf(renderPage(series, [
      { type: "setKeyword", text: "華碩" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "select", code: "華碩 RTX4060" },
      { type: "point", date: "2024-06-15", code: "華碩 DUAL-RTX4070-O12G" },
    ]))
    const removeLabels = [...doc.querySelectorAll('[aria-label="已選"] button')].map((button) => button.textContent)
    const bounds = [...(doc.querySelector('[aria-label="金額軸"]')?.querySelectorAll("span") ?? [])]
      .map((node) => Number(node.textContent))
    const readout = doc.querySelector('[aria-label="讀數"]')
    const pressed = [...doc.querySelectorAll('[aria-label="候選"] button')]
      .map((button) => button.getAttribute("aria-pressed"))

    expect(removeLabels).toEqual(["拿掉", "拿掉"])
    expect(bounds).toHaveLength(2)
    expect(bounds[0]).toBeGreaterThan(0)
    expect(bounds[0]).toBeLessThan(9000)
    expect(bounds[1]).toBeGreaterThan(18990)
    expect(readout?.textContent).toContain("2024-06-15")
    expect(readout?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
    expect(readout?.textContent).toContain("18990")
    expect(pressed).toEqual(["true", "true"])
    expect(doc.body.textContent).not.toContain("登入")
    expect(doc.body.textContent).not.toContain("收藏")
  })
})

const secondCode = "華碩 DUAL-RTX4070-O12G-WHITE"

function twoCardDay(capturedAt: string, leftPrice: number, rightPrice: number): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>｛${code}｝, $${leftPrice}</option>
            <option>｛${secondCode}｝, $${rightPrice}</option>
          </select>
        </td>
      </tr>
    `,
  }
}

describe("多條已選的折線圖", () => {
  test("兩條已選畫在同一張圖上，每條線標出自己的代號", () => {
    const series = update(emptySeries(), [
      twoCardDay("2024-06-15T02:00:00.000Z", 18990, 19990),
      twoCardDay("2024-06-16T02:00:00.000Z", 17990, 20990),
    ])
    const doc = documentOf(renderPage(series, [
      { type: "select", code },
      { type: "select", code: secondCode },
    ]))
    const chart = doc.querySelector('[aria-label="折線圖"]')
    const labels = [...(doc.querySelector('[aria-label="圖例"]')?.querySelectorAll("li") ?? [])]
      .map((item) => item.textContent)
    const lineCodes = [...(chart?.querySelectorAll("line") ?? [])].map((node) => node.getAttribute("data-code"))

    expect(labels).toEqual([code, secondCode])
    expect(lineCodes).toEqual([code, secondCode])
  })

  test("多條已選共用同一條時間軸和同一條金額軸", () => {
    const series = update(emptySeries(), [
      twoCardDay("2024-06-15T02:00:00.000Z", 10000, 30000),
      twoCardDay("2024-06-16T02:00:00.000Z", 20000, 20000),
    ])
    const doc = documentOf(renderPage(series, [
      { type: "select", code },
      { type: "select", code: secondCode },
    ]))
    const points = [...doc.querySelectorAll('[aria-label="折線圖"] [data-date]')].map((node) => ({
      date: node.getAttribute("data-date"),
      seriesCode: node.getAttribute("data-code"),
      x: Number(node.getAttribute("cx")),
      y: Number(node.getAttribute("cy")),
    }))
    const low = points.find((point) => point.date === "2024-06-15" && point.seriesCode === code)
    const high = points.find((point) => point.date === "2024-06-15" && point.seriesCode === secondCode)
    const laterLeft = points.find((point) => point.date === "2024-06-16" && point.seriesCode === code)
    const laterRight = points.find((point) => point.date === "2024-06-16" && point.seriesCode === secondCode)

    expect(doc.querySelectorAll('[aria-label="日期軸"]')).toHaveLength(1)
    expect(doc.querySelectorAll('[aria-label="金額軸"]')).toHaveLength(1)
    expect(doc.querySelectorAll('[aria-label="折線圖"]')).toHaveLength(1)
    expect(low?.x).toBe(high?.x)
    expect(high?.y ?? 0).toBeLessThan(low?.y ?? 0)
    expect(laterLeft?.x).toBe(laterRight?.x)
    expect(laterLeft?.y).toBeCloseTo(laterRight?.y ?? Number.NaN)
    expect(laterLeft?.x ?? 0).toBeGreaterThan(low?.x ?? 0)
  })

  test("從已選拿掉一條，那條線和圖例一起消失", () => {
    const series = update(emptySeries(), [
      twoCardDay("2024-06-15T02:00:00.000Z", 18990, 19990),
      twoCardDay("2024-06-16T02:00:00.000Z", 17990, 20990),
    ])
    const doc = documentOf(renderPage(series, [
      { type: "select", code },
      { type: "select", code: secondCode },
      { type: "deselect", code: secondCode },
    ]))
    const labels = [...(doc.querySelector('[aria-label="圖例"]')?.querySelectorAll("li") ?? [])]
      .map((item) => item.textContent)
    const lineCodes = [...doc.querySelectorAll('[aria-label="折線圖"] line')].map((node) =>
      node.getAttribute("data-code"),
    )

    expect(labels).toEqual([code])
    expect(lineCodes).toEqual([code])
  })

  test("改了關鍵字和晶片分組之後，圖上的線還在", () => {
    const series = update(emptySeries(), [
      {
        capturedAt: "2024-06-15T02:00:00.000Z",
        html: `
          <tr>
            <td>顯示卡VGA</td>
            <td>
              <select name="n12">
                <optgroup label="RTX 4070"><option>｛${code}｝, $18990</option></optgroup>
                <optgroup label="RTX 4060"><option>｛${secondCode}｝, $19990</option></optgroup>
              </select>
            </td>
          </tr>
        `,
      },
      {
        capturedAt: "2024-06-16T02:00:00.000Z",
        html: `
          <tr>
            <td>顯示卡VGA</td>
            <td>
              <select name="n12">
                <optgroup label="RTX 4070"><option>｛${code}｝, $17990</option></optgroup>
                <optgroup label="RTX 4060"><option>｛${secondCode}｝, $20990</option></optgroup>
              </select>
            </td>
          </tr>
        `,
      },
    ])
    const doc = documentOf(renderPage(series, [
      { type: "select", code },
      { type: "select", code: secondCode },
      { type: "setChipGroup", name: "RTX 4060" },
      { type: "setKeyword", text: "不存在的關鍵字" },
    ]))
    const labels = [...(doc.querySelector('[aria-label="圖例"]')?.querySelectorAll("li") ?? [])]
      .map((item) => item.textContent)
    const lineCodes = [...doc.querySelectorAll('[aria-label="折線圖"] line')].map((node) =>
      node.getAttribute("data-code"),
    )

    expect(labels).toEqual([code, secondCode])
    expect(lineCodes).toEqual([code, secondCode])
  })

  test("圖上最多畫 8 條已選", () => {
    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
    const day = (capturedAt: string, offset: number): Snapshot => ({
      capturedAt,
      html: `
        <tr>
          <td>顯示卡VGA</td>
          <td>
            <select name="n12">
              ${codes.map((item, index) => `<option>｛${item}｝, $${1000 + index + offset}</option>`).join("")}
            </select>
          </td>
        </tr>
      `,
    })
    const series = update(emptySeries(), [
      day("2024-06-15T02:00:00.000Z", 0),
      day("2024-06-16T02:00:00.000Z", 100),
    ])
    const doc = documentOf(renderPage(series, codes.map((item) => ({ type: "select" as const, code: item }))))
    const labels = [...(doc.querySelector('[aria-label="圖例"]')?.querySelectorAll("li") ?? [])]
      .map((item) => item.textContent)
    const lineCodes = [...doc.querySelectorAll('[aria-label="折線圖"] line')].map((node) =>
      node.getAttribute("data-code"),
    )

    expect(labels).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"])
    expect(lineCodes).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"])
  })
})
