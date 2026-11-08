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
    ["2024-06-16", "9000", "10000"],
    ["2024-06-17", "9000", "12000"],
  ])
  expect(used.map((node) => [node.getAttribute("data-code"), node.getAttribute("data-date"), node.getAttribute("data-price")])).toEqual([
    [other, "2024-06-15", "7000"],
    [code, "2024-06-15", "8000"],
    [code, "2024-06-17", "15000"],
  ])
  expect(used[1]?.closest("a")?.getAttribute("href")).toBe("https://example.com/posts/8000")
  expect(chart?.textContent).toContain("過去 7 日售價的最高價到最低價")
  expect(chart?.textContent).toContain("月均線")
  expect(chart?.querySelector('path[data-trend][data-window="month"]')?.hasAttribute("hidden")).toBe(false)
  expect(chart?.querySelector('path[data-trend][data-window="quarter"]')?.hasAttribute("hidden")).toBe(true)
  expect(chart?.querySelector('path[data-trend][data-window="hybrid"]')?.hasAttribute("hidden")).toBe(true)
  expect(doc.querySelector('button[aria-label="月均線"]')?.getAttribute("aria-pressed")).toBe("true")
  expect(doc.querySelector('button[aria-label="季均線"]')?.getAttribute("aria-pressed")).toBe("false")
  expect(chart?.textContent).toContain("50% 區間")
  expect(chart?.textContent).toContain("25% 區間")
  expect(chart?.textContent).not.toContain("75%")
  expect(chart?.textContent).not.toContain("半月均線")
  expect(chart?.querySelector('path[data-percentile="75"]')).toBeNull()
  expect(averages(chart).map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-15", 7500],
    ["2024-06-16", 7500],
    ["2024-06-17", 11250],
  ])
  expect(percentiles(chart, "50").map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-15", 7500],
    ["2024-06-16", 7500],
    ["2024-06-17", 11250],
  ])
  expect(percentiles(chart, "25").map(([date, price]) => [date, Number(price)])).toEqual([
    ["2024-06-15", 7500],
    ["2024-06-16", 7500],
    ["2024-06-17", 7500],
  ])
  expect(doc.querySelector("svg[data-trend-chart]")?.getAttribute("data-price-chart")).toBeNull()
})

test("售價面積的每日高低是過去 7 日的滑動極值", () => {
  const rolled = update(emptySeries(), [
    snapshot("2024-06-01T02:00:00.000Z", [`｛${code}｝, $5000`, `｛${other}｝, $8000`]),
    snapshot("2024-06-07T02:00:00.000Z", [`｛${code}｝, $9000`]),
    snapshot("2024-06-08T02:00:00.000Z", [`｛${code}｝, $7000`]),
  ])
  const doc = documentOf(renderPage(rolled, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-30" },
  ]))

  expect(bands(doc, "data-selling-band")).toEqual([
    ["2024-06-01", "5000", "8000"],
    ["2024-06-07", "5000", "9000"],
    ["2024-06-08", "7000", "9000"],
  ])
})

test("季均線只平均3 個月內的每日二手開價", () => {
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
  expect(averages(chart, "month").find((row) => row[0] === "2024-09-02")).toBeUndefined()
  expect(percentiles(chart, "50").find((row) => row[0] === "2024-06-20")?.[1]).toBe("16000")
  expect(percentiles(chart, "25").find((row) => row[0] === "2024-06-20")?.[1]).toBe("11000")
  expect(percentiles(chart, "50").find((row) => row[0] === "2024-09-02")?.[1]).toBe("18000")
  expect(percentiles(chart, "25").find((row) => row[0] === "2024-09-02")?.[1]).toBe("16000")
  expect(chart?.querySelector('path[data-percentile="75"]')).toBeNull()
})

function bands(root: ParentNode | null, attribute: string): string[][] {
  return [...(root?.querySelectorAll(`line[${attribute}]`) ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-low") ?? "",
    node.getAttribute("data-high") ?? "",
  ])
}

function averages(root: ParentNode | null, window: "month" | "quarter" | "hybrid" = "quarter"): string[][] {
  return [...(root?.querySelectorAll(`[data-average][data-window="${window}"]`) ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-price") ?? "",
  ])
}

function percentiles(root: ParentNode | null, share: "25" | "50", window: "month" | "quarter" | "hybrid" = "quarter"): string[][] {
  return [...(root?.querySelectorAll(`circle[data-percentile="${share}"][data-window="${window}"]`) ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-price") ?? "",
  ])
}

function sweetZone(root: ParentNode | null, window: "month" | "quarter" | "hybrid" = "quarter"): string[][] {
  return [...(root?.querySelectorAll(`line[data-sweet-zone][data-window="${window}"]`) ?? [])].map((node) => [
    node.getAttribute("data-date") ?? "",
    node.getAttribute("data-price") ?? "",
  ])
}

test("價差未達 2000 元時，甜蜜區改畫在 25% 區間再低 2000 元以下", () => {
  const wide = update(emptySeries(), [
    snapshot("2024-06-01T02:00:00.000Z", [`｛${code}｝, $18000`]),
  ])
  const doc = documentOf(renderPage(wide, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-06-01", end: "2024-06-07" },
  ], [
    post(10000, "2024-06-01", "https://example.com/a"),
    post(12000, "2024-06-02", "https://example.com/b"),
    post(16000, "2024-06-03", "https://example.com/c"),
    post(16000, "2024-06-04", "https://example.com/d"),
    post(11000, "2024-06-05", "https://example.com/e"),
    post(20000, "2024-06-07", "https://example.com/f"),
  ]))
  const chart = doc.querySelector('[aria-label="價格趨勢"]')
  const area = chart?.querySelector("path[data-sweet-zone]")
  const selling = chart?.querySelector("path[data-selling-band]")
  const lines = [...(chart?.querySelectorAll("line[data-sweet-zone]") ?? [])]

  expect(chart?.textContent).toContain("甜蜜區")
  expect(sweetZone(chart)).toEqual([
    ["2024-06-02", "8000"],
    ["2024-06-03", "10000"],
    ["2024-06-04", "11000"],
    ["2024-06-05", "8500"],
    ["2024-06-06", "8500"],
    ["2024-06-07", "11000"],
  ])
  expect(area?.getAttribute("fill")).toBe("#d97706")
  expect(area?.getAttribute("fill")).not.toBe(selling?.getAttribute("fill"))
  expect(area?.getAttribute("d")?.match(/Z/g)?.length).toBe(1)
  for (const line of lines) {
    const y1 = Number(line.getAttribute("y1"))
    const y2 = Number(line.getAttribute("y2"))
    expect(y2).toBeGreaterThan(y1)
    expect(area?.getAttribute("d")).toContain(`${line.getAttribute("x1")} ${line.getAttribute("y1")}`)
    expect(area?.getAttribute("d")).toContain(`${line.getAttribute("x2")} ${line.getAttribute("y2")}`)
  }
})

test("月季均線在月窗口滿 5 筆時改用月均線", () => {
  const wide = update(emptySeries(), [
    snapshot("2024-06-01T02:00:00.000Z", [`｛${code}｝, $18000`]),
  ])
  const doc = documentOf(renderPage(wide, [
    { type: "setChipGroup", name: "NVIDIA RTX4070" },
    { type: "setRange", start: "2024-05-01", end: "2024-06-05" },
  ], [
    post(30000, "2024-05-01", "https://example.com/old"),
    post(10000, "2024-06-01", "https://example.com/a"),
    post(14000, "2024-06-02", "https://example.com/b"),
    post(18000, "2024-06-03", "https://example.com/c"),
    post(22000, "2024-06-04", "https://example.com/d"),
    post(26000, "2024-06-05", "https://example.com/e"),
  ]))
  const chart = doc.querySelector('[aria-label="價格趨勢"]')
  const hybrid = averages(chart, "hybrid")

  expect(hybrid.find((row) => row[0] === "2024-06-02")?.[1]).toBe("18000")
  expect(hybrid.find((row) => row[0] === "2024-06-04")?.[1]).toBe("18800")
  expect(hybrid.find((row) => row[0] === "2024-06-05")?.[1]).toBe("18000")
  expect(averages(chart, "month").find((row) => row[0] === "2024-06-02")?.[1]).toBe("12000")
  expect(averages(chart, "month").find((row) => row[0] === "2024-06-04")?.[1]).toBe("16000")
  expect(averages(chart, "month").find((row) => row[0] === "2024-06-05")?.[1]).toBe("18000")
  expect(averages(chart, "quarter").find((row) => row[0] === "2024-06-05")?.[1]).toBe("20000")
  expect(averages(chart, "quarter").find((row) => row[0] === "2024-06-05")?.[1]).toBe("20000")
  expect(percentiles(chart, "50", "hybrid").find((row) => row[0] === "2024-06-02")?.[1]).toBe("14000")
  expect(percentiles(chart, "25", "hybrid").find((row) => row[0] === "2024-06-02")?.[1]).toBe("10000")
  expect(percentiles(chart, "50", "hybrid").find((row) => row[0] === "2024-06-05")?.[1]).toBe("18000")
  expect(percentiles(chart, "25", "hybrid").find((row) => row[0] === "2024-06-05")?.[1]).toBe("12000")
  expect(sweetZone(chart, "hybrid").filter((row) => row[0] >= "2024-06-01")).toEqual([
    ["2024-06-01", "10000"],
    ["2024-06-02", "10000"],
    ["2024-06-03", "12000"],
    ["2024-06-04", "12000"],
    ["2024-06-05", "12000"],
  ])
})

test("側邊欄可在月均線與季均線之間切換", () => {
  const listing = "華碩 PRIME-RTX5060TI-8G"
  const group = "NVIDIA RTX5060Ti-8GB"
  const priced = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${listing}｝, $10000`], group),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${listing}｝, $11000`], group),
  ])
  const session = start(priced)
  session.setUsedPosts([
    post(8000, "2024-06-15", "https://example.com/seller/a", listing),
    post(9000, "2024-06-16", "https://example.com/seller/b", listing),
  ])
  const chart = document.querySelector(`[aria-label="${group}"] [aria-label="價格趨勢"]`)
  const month = chart?.querySelector('path[data-trend][data-window="month"]')
  const quarter = chart?.querySelector('path[data-trend][data-window="quarter"]')

  expect(document.querySelector('button[aria-label="月均線"]')?.getAttribute("aria-pressed")).toBe("true")
  expect(month?.hasAttribute("hidden")).toBe(false)
  expect(quarter?.hasAttribute("hidden")).toBe(true)
  expect(chart?.textContent).toContain("月均線")

  document.querySelector<HTMLButtonElement>('button[aria-label="季均線"]')?.click()
  expect(document.querySelector('button[aria-label="季均線"]')?.getAttribute("aria-pressed")).toBe("true")
  expect(document.querySelector('button[aria-label="月均線"]')?.getAttribute("aria-pressed")).toBe("false")
  expect(month?.hasAttribute("hidden")).toBe(true)
  expect(quarter?.hasAttribute("hidden")).toBe(false)
  expect(chart?.textContent).toContain("季均線")
  expect(chart?.textContent).toContain("同一季窗口")

  const hybrid = chart?.querySelector('path[data-trend][data-window="hybrid"]')
  document.querySelector<HTMLButtonElement>('button[aria-label="月季均線"]')?.click()
  expect(document.querySelector('button[aria-label="月季均線"]')?.getAttribute("aria-pressed")).toBe("true")
  expect(document.querySelector('button[aria-label="季均線"]')?.getAttribute("aria-pressed")).toBe("false")
  expect(month?.hasAttribute("hidden")).toBe(true)
  expect(quarter?.hasAttribute("hidden")).toBe(true)
  expect(hybrid?.hasAttribute("hidden")).toBe(false)
  expect(chart?.textContent).toContain("月季均線")
  expect(chart?.textContent).toContain("滿 5 筆")
})

test("滑鼠停在二手開價點上時顯示該筆資訊", () => {
  const listing = "華碩 PRIME-RTX5060TI-8G"
  const group = "NVIDIA RTX5060Ti-8GB"
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
