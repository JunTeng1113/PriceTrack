// @vitest-environment happy-dom

import { expect, test } from "vitest"
import { start } from "../src/browse.ts"
import { renderPage } from "../src/page.ts"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"
import type { UsedPost } from "../src/used-post.ts"

const group = "NVIDIA RTX5060-8GB"
const asus = "華碩 DUAL-RTX5060-O8G"
const gigabyte = "技嘉 RTX5060 WINDFORCE 8G"

function snapshot(capturedAt: string, rows: readonly string[]): Snapshot {
  const options = rows.map((row) => `<option>${row}</option>`).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <optgroup label="NVIDIA RTX5060-8G">${options}</optgroup>
            <optgroup label="NVIDIA RTX5070">
              <option>華碩 DUAL-RTX5070-O12G(2497MHz), $20990</option>
            </optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

function series() {
  return update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`${asus}(2497MHz), $9990`, `${gigabyte}(2497MHz), $8990`]),
    snapshot("2024-06-16T02:00:00.000Z", [`${asus}(2497MHz), $10990`, `${gigabyte}(2497MHz), $9890`]),
  ])
}

function post(code: string, date: string, price: number): UsedPost {
  return { code, date, price, link: `https://example.com/${price}`, seller: `https://example.com/seller/${price}` }
}

const posts = [
  post(asus, "2024-06-15", 10000),
  post(asus, "2024-06-15", 11000),
  post(asus, "2024-06-16", 12000),
  post(asus, "2024-06-16", 13000),
  post(asus, "2024-06-16", 14000),
  post(asus, "2024-06-17", 99999),
  post(gigabyte, "2024-06-15", 8000),
  post("沒有這張卡", "2024-06-15", 1),
]

function documentOf(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

test("同一份報價只整理一次", () => {
  const prepared = series()
  const first = present(prepared, [])
  present(prepared, [{ type: "setGeneration", name: "40" }])
  const again = present(prepared, [])
  const line = first.modelCharts.find((chart) => chart.group === group)?.allSeries[0]?.quotes
  const repeated = again.modelCharts.find((chart) => chart.group === group)?.allSeries[0]?.quotes

  expect(line).toBeDefined()
  expect(repeated).toBe(line)
})

test("區間內同一代號合成一個盒鬚圖，畫在該晶片分組折線下方", () => {
  const doc = documentOf(renderPage(series(), [{ type: "setRange", start: "2020-01-01", end: "2024-06-16" }], posts))
  const section = doc.querySelector(`[aria-label="${group}"]`)
  const boxes = [...(section?.querySelectorAll('[aria-label="盒鬚圖"]') ?? [])]
  const asusBox = section?.querySelector(`[data-used] [data-code="${asus}"]`)
  const other = doc.querySelector('[aria-label="NVIDIA RTX5070"]')

  expect(section?.querySelector("[data-used]")?.getAttribute("aria-label")).toBe("二手行情")
  expect(section?.querySelector("[data-used-axis='y']")?.getAttribute("font-size")).toBe("8")
  expect(section?.querySelector("svg")?.getAttribute("data-price-chart")).toBe("")
  expect(boxes).toHaveLength(2)
  expect(asusBox?.getAttribute("data-min")).toBe("10000")
  expect(asusBox?.getAttribute("data-q1")).toBe("10500")
  expect(asusBox?.getAttribute("data-median")).toBe("12000")
  expect(asusBox?.getAttribute("data-q3")).toBe("13500")
  expect(asusBox?.getAttribute("data-max")).toBe("14000")
  expect(asusBox?.querySelector("[data-median]")).not.toBeNull()
  expect([...(section?.querySelectorAll(`[data-code="${asus}"]`) ?? [])].filter((node) => node.closest("[data-used]") !== null)).toHaveLength(1)
  expect(asusBox?.parentElement?.parentElement?.querySelectorAll("a")).toHaveLength(5)
  expect(section?.textContent).not.toContain("99999")
  expect(other?.querySelector("[data-used]")).toBeNull()
  const highest = [...(section?.querySelectorAll('svg[data-price-chart] text[data-axis="y"]') ?? [])].at(-1)?.textContent ?? ""
  expect(Number(highest.replaceAll("$", "").replaceAll(",", ""))).toBeGreaterThanOrEqual(14000)
})

test("品牌按鈕只留該品牌的盒鬚圖，而且不重畫整頁", () => {
  const session = start(series())
  session.setUsedPosts(posts)
  const marker = document.createElement("p")
  marker.id = "keep"
  document.body.append(marker)

  const button = (name: string): HTMLButtonElement | undefined =>
    [...document.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')]
      .find((node) => node.textContent === name)
  const boxCodes = (): string[] =>
    [...document.querySelectorAll(`[aria-label="${group}"] [data-used] [data-code]`)]
      .map((node) => node.getAttribute("data-code") ?? "")

  expect(new Set(boxCodes())).toEqual(new Set([asus, gigabyte]))
  button("技嘉")?.click()
  expect(boxCodes()).toEqual([gigabyte])
  expect(document.getElementById("keep")).not.toBeNull()

  button("技嘉")?.click()
  expect(new Set(boxCodes())).toEqual(new Set([asus, gigabyte]))
  expect(document.getElementById("keep")).not.toBeNull()
})
