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

  test("介面文字為繁體中文", () => {
    const series = update(emptySeries(), [snapshot])
    const doc = documentOf(renderPage(series, []))

    expect(doc.documentElement.lang).toBe("zh-Hant")
    expect(doc.body.textContent).toContain("關鍵字")
    expect(doc.body.textContent).toContain("已選")
    expect(doc.body.textContent).toContain("價格序列")
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
    const selected = [...(doc.querySelector('[aria-label="已選"]')?.querySelectorAll("li") ?? [])]
      .map((item) => item.textContent)
    const chart = sectionByHeading(doc, "價格序列")
    const points = [...(chart?.querySelectorAll("li") ?? [])]

    expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
    expect(points).toHaveLength(1)
    expect(points[0]?.textContent).toContain("2024-06-15")
    expect(points[0]?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
    expect(points[0]?.textContent).toContain("18990")
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
