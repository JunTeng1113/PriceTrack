// @vitest-environment happy-dom

import { describe, expect, test } from "vitest"
import { renderPage } from "../src/page.ts"
import { emptySeries, taipeiToday, update, type Snapshot } from "../src/present.ts"

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
  test("頁面上沒有價格序列", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(sectionByHeading(doc, "價格序列")).toBeNull()
    expect(doc.body.textContent).not.toContain("價格序列")
    expect(doc.querySelector('[aria-label="折線圖"]')).toBeNull()
  })

  test("頁面上沒有關鍵字欄", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.querySelector('input[aria-label="關鍵字"]')).toBeNull()
    expect(doc.body.textContent).not.toContain("關鍵字")
  })

  test("介面文字為繁體中文", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.documentElement.lang).toBe("zh-Hant")
    expect(doc.body.textContent).toContain("搜尋")
    expect(doc.body.textContent).not.toContain("已選")
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
    const items = [...doc.querySelectorAll('[aria-label="候選"] button')].map((item) => item.textContent)

    expect(items).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("候選表格列出離迄日最近的售價", () => {
    const series = update(emptySeries(), [
      snapshot,
      {
        capturedAt: "2024-06-20T02:00:00.000Z",
        html: snapshot.html.replace("$18990", "$17990"),
      },
    ])
    const nearest = documentOf(renderPage(series, [{ type: "setKeyword", text: "DUAL" }]))
    const table = nearest.querySelector('[aria-label="候選"]')
    const heads = [...(table?.querySelectorAll("th") ?? [])].map((cell) => cell.textContent)
    const cells = [...(table?.querySelectorAll("tbody td") ?? [])].map((cell) => cell.textContent)

    expect(table?.getAttribute("data-slot")).toBe("table")
    expect(table?.closest("details")?.querySelector("summary")?.textContent).toBe("型號列表（1）")
    expect(table?.closest("details")?.hasAttribute("open")).toBe(false)
    expect(heads).toEqual(["型號名稱", "價格", "日期"])
    expect(cells).toEqual(["華碩 DUAL-RTX4070-O12G", "$17,990", "2024-06-20"])

    const earlier = documentOf(renderPage(series, [
      { type: "setKeyword", text: "DUAL" },
      { type: "setRange", start: "2024-06-01", end: "2024-06-16" },
    ]))
    const earlierCells = [...earlier.querySelectorAll('[aria-label="候選"] tbody td')]
      .map((cell) => cell.textContent)
    expect(earlierCells).toEqual(["華碩 DUAL-RTX4070-O12G", "$18,990", "2024-06-15"])
  })

  test("加入已選後圖上有該台北日的售價", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, [
      { type: "setKeyword", text: "DUAL-RTX4070" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
    ]))
    const selected = [...(doc.querySelector('[aria-label="已選"]')?.querySelectorAll("li span") ?? [])]
      .map((item) => item.textContent)

    expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("起日和迄日仍是日期欄位", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.querySelector('input[aria-label="起日"]')?.getAttribute("type")).toBe("date")
    expect(doc.querySelector('input[aria-label="迄日"]')?.getAttribute("type")).toBe("date")
  })

  test("內容和畫面邊界留有間距", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))
    const frame = doc.querySelector(".p-4")

    expect(frame?.classList.contains("p-4")).toBe(true)
    expect(frame?.classList.contains("md:p-6")).toBe(true)
  })

  test("篩選用直向間距與小字", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))
    const filter = sectionByHeading(doc, "篩選")

    expect(filter?.classList.contains("flex")).toBe(true)
    expect(filter?.classList.contains("flex-col")).toBe(true)
    expect(filter?.classList.contains("gap-6")).toBe(true)
    expect(filter?.classList.contains("mb-6")).toBe(true)
    expect(filter?.classList.contains("text-sm")).toBe(true)
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

describe("多日走勢", () => {
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
  test("打開頁面時迄日是台北今天，起日是 2020-01-01", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe(taipeiToday())
    expect(inputValue(doc, "起日")).toBe("2020-01-01")
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
    const selected = [...(doc.querySelector('[aria-label="已選"]')?.querySelectorAll("li span") ?? [])]
      .map((item) => item.textContent)

    expect(inputValue(doc, "起日")).toBe("2023-01-01")
    expect(inputValue(doc, "迄日")).toBe("2023-02-01")
    expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(doc.querySelector('[aria-label="折線圖"]')).toBeNull()
  })

  test("只有閏日報價時，起日仍是 2020-01-01", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-02-29T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe(taipeiToday())
    expect(inputValue(doc, "起日")).toBe("2020-01-01")
  })

  test("預設起日不早於 2020-01-01", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2020-06-15T02:00:00.000Z", 18990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe(taipeiToday())
    expect(inputValue(doc, "起日")).toBe("2020-01-01")
  })

  test("多筆日報價時迄日仍是台北今天", () => {
    const series = update(emptySeries(), [
      pricedSnapshot("2024-06-15T02:00:00.000Z", 18990),
      pricedSnapshot("2024-08-01T02:00:00.000Z", 17990),
    ])
    const doc = documentOf(renderPage(series, []))

    expect(inputValue(doc, "迄日")).toBe(taipeiToday())
    expect(inputValue(doc, "起日")).toBe("2020-01-01")
  })

  test("完全沒有日報價時起迄日是空的", () => {
    const doc = documentOf(renderPage(emptySeries(), []))

    expect(inputValue(doc, "起日")).toBe("")
    expect(inputValue(doc, "迄日")).toBe("")
    expect(sectionByHeading(doc, "價格序列")).toBeNull()
  })
})

describe("篩選候選", () => {
  test("晶片分組選單列出曾出現的全部分組，包含查詢區間以外的型號", () => {
    const series = update(emptySeries(), [
      {
        capturedAt: "2024-01-15T02:00:00.000Z",
        html: `
          <tr>
            <td>顯示卡VGA</td>
            <td>
              <select name="n12">
                <optgroup label="NVIDIA RTX3060">
                  <option>｛華碩 DUAL-RTX3060-O8G｝, $9990</option>
                </optgroup>
              </select>
            </td>
          </tr>
        `,
      },
      {
        capturedAt: "2026-01-15T02:00:00.000Z",
        html: `
          <tr>
            <td>顯示卡VGA</td>
            <td>
              <select name="n12">
                <optgroup label="NVIDIA RTX5090">
                  <option>｛華碩 TUF-RTX5090-O32G-GAMING｝, $99990</option>
                </optgroup>
              </select>
            </td>
          </tr>
        `,
      },
    ])
    const doc = documentOf(renderPage(series, []))
    const items = [...(doc.querySelector('[aria-label="核心規格"]')
      ?.closest('[data-slot="select"]')
      ?.querySelectorAll('[data-slot="select-item"]') ?? [])]
      .map((item) => item.textContent)

    expect(items).toEqual(["NVIDIA RTX5090", "NVIDIA RTX3060-8GB"])
    expect(doc.querySelector('[data-slot="select-content"]')?.classList.contains("overflow-y-auto")).toBe(true)
  })

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
    const trigger = doc.querySelector('[aria-label="核心規格"]')
    const items = [...(trigger?.closest('[data-slot="select"]')?.querySelectorAll('[data-slot="select-item"]') ?? [])]
      .map((item) => item.textContent)

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
    const groups = [...(doc.querySelector('[aria-label="核心規格"]')
      ?.closest('[data-slot="select"]')
      ?.querySelectorAll('[data-slot="select-item"]') ?? [])]
      .map((item) => item.textContent ?? "")
    const candidates = [...doc.querySelectorAll('[aria-label="候選"] button')]
      .map((item) => item.textContent)

    expect(groups).toEqual(["RTX 4070", "RTX 4060"])
    expect(candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })
})

describe("已選", () => {
  test("已選可以拿掉", () => {
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
    const pressed = [...doc.querySelectorAll('[aria-label="候選"] button')]
      .map((button) => button.getAttribute("aria-pressed"))

    expect(removeLabels).toEqual(["拿掉", "拿掉"])
    expect(doc.querySelector('[aria-label="讀數"]')).toBeNull()
    expect(pressed).toEqual(["true", "true"])
    expect(doc.body.textContent).not.toContain("登入")
    expect(doc.body.textContent).not.toContain("收藏")
  })
})


