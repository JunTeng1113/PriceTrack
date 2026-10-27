// @vitest-environment happy-dom

import { expect, test } from "vitest"
import { start } from "../src/browse.ts"
import { renderPage } from "../src/page.ts"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"
import type { UsedPost } from "../src/used-post.ts"

const code = "華碩 DUAL-RTX4070-O12G"
const other = "技嘉 RTX4070 WINDFORCE"

function snapshot(capturedAt: string, rows: readonly string[], label = "NVIDIA RTX4070"): Snapshot {
  const options = rows.map((row) => `<option>${row}</option>`).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <optgroup label="${label}">${options}</optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

function post(price: number, date: string, seller = `https://example.com/seller/${price}`, listing = code): UsedPost {
  return {
    code: listing,
    date,
    price,
    link: `https://example.com/posts/${price}`,
    seller,
  }
}

function documentOf(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

const series = update(emptySeries(), [
  snapshot("2024-06-15T02:00:00.000Z", [`｛${code}｝, $10000`, `｛${other}｝, $9000`]),
  snapshot("2024-06-16T02:00:00.000Z", [`｛${other}｝, $9100`]),
  snapshot("2024-06-17T02:00:00.000Z", [`｛${code}｝, $12000`, `｛${other}｝, $9200`]),
])

const posts = [
  post(8000, "2024-06-15", "https://example.com/a"),
  post(9000, "2024-06-15", "https://example.com/a"),
  post(7000, "2024-06-15", "https://example.com/gigabyte", other),
  post(15000, "2024-06-17", "https://example.com/b"),
  post(1, "2023-01-01"),
]

test("售價連成面積，二手開價只留散佈點", () => {
  const doc = documentOf(renderPage(series, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ], posts))
  const chart = doc.querySelector('[aria-label="價格趨勢"]')
  const used = [...(chart?.querySelectorAll("[data-used-price]") ?? [])]

  expect(chart?.querySelector("h2")?.textContent).toBe("價格趨勢")
  expect(chart?.parentElement?.getAttribute("aria-label")).toBe("NVIDIA RTX4070")
  expect([...(chart?.parentElement?.children ?? [])].map((node) => node.getAttribute("aria-label") ?? node.tagName)).toEqual(["H3", "svg", "價格趨勢", "二手行情"])
  expect(chart?.querySelector("[data-selling-price]")).toBeNull()
  expect(chart?.querySelector("path[data-selling-band]")?.getAttribute("d")?.startsWith("M")).toBe(true)
  expect(chart?.querySelector("[data-used-band]")).toBeNull()
  expect(chart?.textContent).not.toContain("橘色面積")
  expect(bands(chart, "data-selling-band")).toEqual([
    ["2024-06-15", "9000", "10000"],
    ["2024-06-16", "9100", "9100"],
    ["2024-06-17", "9200", "12000"],
  ])
  expect(used.map((node) => [node.getAttribute("data-code"), node.getAttribute("data-date"), node.getAttribute("data-price")])).toEqual([
    [other, "2024-06-15", "7000"],
    [code, "2024-06-15", "8000"],
    [code, "2024-06-17", "15000"],
  ])
  expect(used[1]?.closest("a")?.getAttribute("href")).toBe("https://example.com/posts/8000")
  expect(chart?.textContent).toContain("季均線")
  expect(chart?.textContent).not.toContain("半月均線")
  expect(averages(chart).map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-15", 7500],
    ["2024-06-16", 7500],
    ["2024-06-17", 11250],
  ])
  expect(doc.querySelector("svg[data-trend-chart]")?.getAttribute("data-price-chart")).toBeNull()
})

test("季均線只平均三個月內的每日二手開價", () => {
  const flat = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${code}｝, $10000`]),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${code}｝, $10000`]),
    snapshot("2024-06-17T02:00:00.000Z", [`｛${code}｝, $10000`]),
  ])
  const view = present(flat, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ], [
    post(10000, "2024-05-15", "https://example.com/early"),
    post(14000, "2024-05-16", "https://example.com/kept"),
    post(20000, "2024-06-16"),
  ])
  const doc = documentOf(renderPage(flat, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-05-01", end: "2024-06-30" },
  ], [
    post(10000, "2024-05-15", "https://example.com/early"),
    post(14000, "2024-05-16", "https://example.com/kept"),
    post(20000, "2024-06-16"),
  ]))
  expect(view.trend[0]?.group).toBe("NVIDIA RTX4070")
  expect(bands(doc, "data-selling-band")).toEqual([
    ["2024-06-15", "10000", "10000"],
    ["2024-06-16", "10000", "10000"],
    ["2024-06-17", "10000", "10000"],
  ])
  expect(doc.querySelector("[data-used-band]")).toBeNull()
  expect(averages(doc).find((row) => row[0] === "2024-05-15")).toBeUndefined()
  expect(averages(doc).find((row) => row[0] === "2024-06-15")?.[1]).toBe("12000")
  expect(Number(averages(doc).find((row) => row[0] === "2024-06-16")?.[1])).toBeCloseTo(44000 / 3, 5)
})

test("季均線隨日期滾動，滿一季後剔除窗口外的每日開價", () => {
  const wide = update(emptySeries(), [
    snapshot("2024-06-01T02:00:00.000Z", [`｛${code}｝, $18000`]),
    snapshot("2024-06-10T02:00:00.000Z", [`｛${code}｝, $18000`]),
    snapshot("2024-06-20T02:00:00.000Z", [`｛${code}｝, $18000`]),
    snapshot("2024-09-02T02:00:00.000Z", [`｛${code}｝, $18000`]),
  ])
  const doc = documentOf(renderPage(wide, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-09-30" },
  ], [
    post(10000, "2024-06-01", "https://example.com/old"),
    post(12000, "2024-06-01", "https://example.com/other"),
    post(16000, "2024-06-10", "https://example.com/new"),
    post(20000, "2024-06-20", "https://example.com/late"),
  ]))
  const chart = doc.querySelector('[aria-label="價格趨勢"]')
  const rows = averages(chart)

  expect(chart?.querySelector("[data-used-price]")).not.toBeNull()
  expect(rows.find((row) => row[0] === "2024-06-01")?.[1]).toBe("11000")
  expect(rows.find((row) => row[0] === "2024-06-10")?.[1]).toBe("13500")
  expect(Number(rows.find((row) => row[0] === "2024-06-20")?.[1])).toBeCloseTo(47000 / 3, 5)
  expect(rows.find((row) => row[0] === "2024-09-02")?.[1]).toBe("18000")
})

function bands(root: ParentNode | null, attribute: string): string[][] {
  return [...(root?.querySelectorAll(`line[${attribute}]`) ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-low") ?? "",
    node.getAttribute("data-high") ?? "",
  ])
}

function averages(root: ParentNode | null): string[][] {
  return [...(root?.querySelectorAll("[data-average]") ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-price") ?? "",
  ])
}

test("滑鼠停在二手開價點上時顯示該筆資訊", () => {
  const listing = "華碩 PRIME-RTX5060TI-8G"
  const group = "NVIDIA RTX5060Ti-8GB(GDDR7)"
  const priced = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${listing}｝, $10000`], group),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${listing}｝, $11000`], group),
  ])
  const session = start(priced)
  session.setUsedPosts([
    post(8000, "2024-06-15", "https://example.com/seller/a", listing),
    post(9000, "2024-06-16", "https://example.com/seller/b", listing),
  ])
  const dot = document.querySelector(`[aria-label="${group}"] [data-used-price][data-date="2024-06-15"]`)
  const rows = (): string[] =>
    [...document.querySelectorAll('[role="tooltip"] p')].map((node) => node.textContent ?? "")

  dot?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 24, clientY: 30 }))
  expect(document.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(false)
  expect(rows()).toEqual(["2024-06-15", listing, "$8,000", "二手開價"])

  dot?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
  expect(document.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(true)
})

test("搜尋晶片分組後直接畫同一晶片圖，選代號不影響", () => {
  const searched = documentOf(renderPage(series, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
  ], posts))
  const selectedToo = documentOf(renderPage(series, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "select", code },
    { type: "select", code: other },
  ], posts))

  expect(searched.querySelector('[aria-label="價格趨勢"] h2')?.textContent).toBe("價格趨勢")
  expect(searched.querySelector('[aria-label="NVIDIA RTX4070"] [aria-label="價格趨勢"]')).not.toBeNull()
  expect(selectedToo.querySelectorAll('[aria-label="價格趨勢"]')).toHaveLength(1)
  expect(documentOf(renderPage(series, [{ type: "select", code }], posts)).querySelector('[aria-label="價格趨勢"]')).toBeNull()
  expect(present(series, []).trend).toEqual([])
  expect(present(series, [{ type: "select", code }]).trend).toEqual([])
})
