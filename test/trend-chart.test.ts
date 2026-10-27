// @vitest-environment happy-dom

import { expect, test } from "vitest"
import { renderPage } from "../src/page.ts"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"
import type { UsedPost } from "../src/used-post.ts"

const code = "華碩 DUAL-RTX4070-O12G"
const other = "技嘉 RTX4070 WINDFORCE"

function snapshot(capturedAt: string, rows: readonly string[]): Snapshot {
  const options = rows.map((row) => `<option>${row}</option>`).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <optgroup label="NVIDIA RTX4070">${options}</optgroup>
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

test("只選一個代號時，售價與二手開價各自連成面積", () => {
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
  expect(chart?.querySelector("path[data-used-band]")?.getAttribute("d")?.startsWith("M")).toBe(true)
  expect(bands(chart, "data-selling-band")).toEqual([
    ["2024-06-15", "9000", "10000"],
    ["2024-06-16", "9100", "9100"],
    ["2024-06-17", "9200", "12000"],
  ])
  expect(bands(chart, "data-used-band")).toEqual([
    ["2024-06-15", "7000", "8000"],
    ["2024-06-16", "15000", "15000"],
    ["2024-06-17", "15000", "15000"],
  ])
  expect(used.map((node) => [node.getAttribute("data-code"), node.getAttribute("data-date"), node.getAttribute("data-price")])).toEqual([
    [other, "2024-06-15", "7000"],
    [code, "2024-06-15", "8000"],
    [code, "2024-06-17", "15000"],
  ])
  expect(used[1]?.closest("a")?.getAttribute("href")).toBe("https://example.com/posts/8000")
  expect(chart?.textContent).toContain("半月均線")
  expect(averages(chart).map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-15", 7500],
    ["2024-06-16", 15000],
    ["2024-06-17", 15000],
  ])
  expect(doc.querySelector("svg[data-trend-chart]")?.getAttribute("data-price-chart")).toBeNull()
})

test("下半月的均線不含 1–15 日的二手開價", () => {
  const flat = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${code}｝, $10000`]),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${code}｝, $10000`]),
    snapshot("2024-06-17T02:00:00.000Z", [`｛${code}｝, $10000`]),
  ])
  const view = present(flat, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ], [post(20000, "2024-06-16")])
  const doc = documentOf(renderPage(flat, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ], [post(20000, "2024-06-16")]))
  expect(view.trend[0]?.group).toBe("NVIDIA RTX4070")
  expect(bands(doc, "data-selling-band")).toEqual([
    ["2024-06-15", "10000", "10000"],
    ["2024-06-16", "10000", "10000"],
    ["2024-06-17", "10000", "10000"],
  ])
  expect(bands(doc, "data-used-band")).toEqual([
    ["2024-06-16", "20000", "20000"],
    ["2024-06-17", "20000", "20000"],
  ])
  expect(averages(doc).map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-16", 20000],
    ["2024-06-17", 20000],
  ])
})

test("半月均線把 1–15 日與 16 日至月底分開平均", () => {
  const wide = update(emptySeries(), [
    snapshot("2024-06-01T02:00:00.000Z", [`｛${code}｝, $18000`]),
    snapshot("2024-06-10T02:00:00.000Z", [`｛${code}｝, $18000`]),
    snapshot("2024-06-20T02:00:00.000Z", [`｛${code}｝, $18000`]),
  ])
  const doc = documentOf(renderPage(wide, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ], [
    post(10000, "2024-06-01", "https://example.com/old"),
    post(12000, "2024-06-01", "https://example.com/other"),
    post(16000, "2024-06-10", "https://example.com/new"),
    post(20000, "2024-06-20", "https://example.com/late"),
  ]))
  const chart = doc.querySelector('[aria-label="價格趨勢"]')
  const rows = averages(chart)

  expect(bands(chart, "data-used-band").find((row) => row[0] === "2024-06-01")).toEqual(["2024-06-01", "10000", "16000"])
  expect(bands(chart, "data-used-band").find((row) => row[0] === "2024-06-15")).toEqual(["2024-06-15", "10000", "16000"])
  expect(bands(chart, "data-used-band").find((row) => row[0] === "2024-06-16")).toEqual(["2024-06-16", "20000", "20000"])
  expect(rows[0]).toEqual(["2024-06-01", "13500"])
  expect(rows.find((row) => row[0] === "2024-06-15")?.[1]).toBe("13500")
  expect(rows.find((row) => row[0] === "2024-06-16")?.[1]).toBe("20000")
  expect(rows.find((row) => row[0] === "2024-06-20")?.[1]).toBe("20000")
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
