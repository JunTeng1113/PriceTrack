// @vitest-environment happy-dom

import { describe, expect, test } from "vitest"
import { renderPage } from "../src/page.ts"
import { emptySeries, update, type Snapshot } from "../src/present.ts"

const modelGroup = "NVIDIA RTX5060Ti-8GB(GDDR7)"

function snapshot(capturedAt: string, groups: readonly { label: string; rows: readonly string[] }[]): Snapshot {
  const blocks = groups
    .map((group) => {
      const options = group.rows.map((row) => `<option>${row}</option>`).join("")
      return `<optgroup label="${group.label}">${options}</optgroup>`
    })
    .join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">${blocks}</select>
        </td>
      </tr>
    `,
  }
}

function documentOf(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

describe("每個晶片分組一張圖", () => {
  test("分組原文不同就各有一張圖", () => {
    const twelveG = "NVIDIA RTX4070-12G"
    const twelveGb = "NVIDIA RTX4070-12GB"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: twelveG, rows: ["華碩 DUAL-RTX4070-O12G(2535MHz), $18990"] },
        { label: twelveGb, rows: ["華碩 TUF-RTX4070-O12G(2565MHz), $20990"] },
      ]),
    ])
    const doc = documentOf(renderPage(series, []))
    const narrow = doc.querySelector(`[aria-label="${twelveG}"]`)
    const wide = doc.querySelector(`[aria-label="${twelveGb}"]`)

    expect(narrow?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
    expect(narrow?.querySelector('[data-price="18990"]')).not.toBeNull()
    expect(narrow?.querySelector('[data-price="20990"]')).toBeNull()
    expect(wide?.textContent).toContain("華碩 TUF-RTX4070-O12G")
    expect(wide?.querySelector('[data-price="20990"]')).not.toBeNull()
    expect(wide?.querySelector('[data-price="18990"]')).toBeNull()
  })

  test("選一個品牌後只有該圖留該品牌", () => {
    const twelveG = "NVIDIA RTX4070-12G"
    const twelveGb = "NVIDIA RTX4070-12GB"
    const asusNarrow = "華碩 DUAL-RTX4070-O12G"
    const gigabyteNarrow = "技嘉 RTX4070 WINDFORCE OC 12G"
    const asusWide = "華碩 TUF-RTX4070-O12G"
    const gigabyteWide = "技嘉 RTX4070 GAMING OC 12G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        {
          label: twelveG,
          rows: [`${asusNarrow}(2535MHz), $18990`, `${gigabyteNarrow}(2520MHz), $17990`],
        },
        {
          label: twelveGb,
          rows: [`${asusWide}(2565MHz), $20990`, `${gigabyteWide}(2535MHz), $19990`],
        },
      ]),
    ])
    const open = documentOf(renderPage(series, []))
    const codesOf = (doc: Document, label: string): string[] =>
      [...(doc.querySelector(`[aria-label="${label}"]`)?.querySelectorAll("[data-code]") ?? [])]
        .map((node) => node.getAttribute("data-code") ?? "")
    expect(new Set(codesOf(open, twelveG))).toEqual(new Set([asusNarrow, gigabyteNarrow]))
    expect(new Set(codesOf(open, twelveGb))).toEqual(new Set([asusWide, gigabyteWide]))

    const filtered = documentOf(renderPage(series, [{ type: "setBrand", group: twelveG, name: "華碩" }]))
    expect(new Set(codesOf(filtered, twelveG))).toEqual(new Set([asusNarrow]))
    expect(new Set(codesOf(filtered, twelveGb))).toEqual(new Set([asusWide, gigabyteWide]))
  })

  test("選了晶片分組就只留那一張圖", () => {
    const twelveG = "NVIDIA RTX4070-12G"
    const twelveGb = "NVIDIA RTX4070-12GB"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: twelveG, rows: ["華碩 DUAL-RTX4070-O12G(2535MHz), $18990"] },
        { label: twelveGb, rows: ["華碩 TUF-RTX4070-O12G(2565MHz), $20990"] },
      ]),
    ])
    const doc = documentOf(renderPage(series, [{ type: "setChipGroup", name: twelveG }]))

    expect(doc.querySelector(`[aria-label="${twelveG}"]`)).not.toBeNull()
    expect(doc.querySelector(`[aria-label="${twelveGb}"]`)).toBeNull()
  })

  test("另一張分組圖也把缺日前後的日報價連起來", () => {
    const twelveG = "NVIDIA RTX4070-12G"
    const code = "華碩 DUAL-RTX4070-O12G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $18990`] }]),
      snapshot("2024-06-17T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $17990`] }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${twelveG}"]`)

    expect(chart?.querySelectorAll("line")).toHaveLength(1)
    expect(chart?.querySelector("[data-date='2024-06-16']")).toBeNull()
    expect(chart?.textContent).not.toContain("2024-06-16")
  })

  test("圖上有背景、日期軸、金額軸和格線", () => {
    const twelveG = "NVIDIA RTX4070-12G"
    const code = "華碩 DUAL-RTX4070-O12G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $18990`] }]),
      snapshot("2024-06-16T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $17990`] }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const svg = doc.querySelector(`[aria-label="${twelveG}"] svg`)
    const yLabels = [...(svg?.querySelectorAll('text[data-axis="y"]') ?? [])].map((node) => Number(node.textContent))
    const prices = [...yLabels].sort((left, right) => left - right)
    const lastPoint = svg?.querySelector('[data-date="2024-06-16"]')
    const name = [...(svg?.querySelectorAll("text[data-series-label]") ?? [])].find((node) => node.textContent === code)

    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 100")
    expect(svg?.getAttribute("style")).toContain("aspect-ratio:4/1")
    expect(svg?.querySelector('[data-axis="background"]')?.getAttribute("fill")).toBe("#e8eef7")
    expect(svg?.querySelector('[data-axis="x"]')).not.toBeNull()
    expect(svg?.querySelector('[data-axis="y"]')).not.toBeNull()
    expect(svg?.querySelector('[data-axis="grid"]')).not.toBeNull()
    expect([...(svg?.querySelectorAll('text[data-axis="x"]') ?? [])].map((node) => node.textContent)).toEqual(["2024-06"])
    expect(prices).toHaveLength(11)
    expect(prices[0]).toBe(Math.round(17990 * 0.95))
    expect(prices[10]).toBe(Math.round(18990 * 1.05))
    expect(Number(name?.getAttribute("x"))).toBeGreaterThan(Number(lastPoint?.getAttribute("cx")))
    expect(svg?.querySelector('[aria-label="圖例"]')).toBeNull()
  })
})

describe("RTX5060Ti-8GB 型號圖", () => {
  test("打開頁面就看得到這個分組的售價，不用先勾選代號", () => {
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: modelGroup, rows: ["華碩 PRIME-RTX5060TI-8G(2505MHz), $18990"] },
        { label: "NVIDIA RTX4070", rows: ["｛華碩 DUAL-RTX4070-O12G｝, $9000"] },
      ]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)

    expect(chart?.querySelector("h3")?.textContent).toBe(modelGroup)
    expect(chart?.textContent).toContain("華碩 PRIME-RTX5060TI-8G")
    expect(chart?.querySelector('[data-price="18990"]')).not.toBeNull()
    expect(chart?.querySelector('[data-price="9000"]')).toBeNull()
    expect(doc.querySelector('[aria-label="已選"]')?.textContent).not.toContain("華碩 PRIME-RTX5060TI-8G")
  })

  test("有無超頻、顏色不同的代號在同一張圖上，各是一條線", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const primeOc = "華碩 PRIME-RTX5060TI-O8G"
    const dual = "華碩 DUAL-RTX5060TI-O8G"
    const dualWhite = "華碩 DUAL-RTX5060TI-O8G-WHITE"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        {
          label: modelGroup,
          rows: [
            `${prime}(2505MHz), $18990`,
            `${primeOc}(2587MHz), $19990`,
            `${dual}(2587MHz), $17990`,
            `${dualWhite}(2587MHz), $20990`,
          ],
        },
      ]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const codes = [...(chart?.querySelectorAll("[data-code]") ?? [])].map((node) => node.getAttribute("data-code"))

    expect(doc.querySelectorAll(`[aria-label="${modelGroup}"]`)).toHaveLength(1)
    expect(new Set(codes)).toEqual(new Set([prime, primeOc, dual, dualWhite]))
  })

  test("缺日仍把前後日報價連起來，中間沒有補售價", () => {
    const code = "華碩 PRIME-RTX5060TI-8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: modelGroup, rows: [`${code}(2505MHz), $10000`] }]),
      snapshot("2024-06-16T02:00:00.000Z", [{ label: modelGroup, rows: [`${code}(2505MHz), $11000`] }]),
      snapshot("2024-06-18T02:00:00.000Z", [{ label: modelGroup, rows: [`${code}(2505MHz), $14000`] }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const points = [...(chart?.querySelectorAll("[data-date]") ?? [])].map((node) => ({
      date: node.getAttribute("data-date"),
      x: Number(node.getAttribute("cx")),
    }))
    const oneDay = (points[1]?.x ?? 0) - (points[0]?.x ?? 0)
    const twoDays = (points[2]?.x ?? 0) - (points[1]?.x ?? 0)

    expect(points.map((point) => point.date)).toEqual(["2024-06-15", "2024-06-16", "2024-06-18"])
    expect(chart?.querySelectorAll("line")).toHaveLength(2)
    expect(chart?.querySelector("[data-date='2024-06-17']")).toBeNull()
    expect(chart?.textContent).not.toContain("2024-06-17")
    expect(twoDays).toBeCloseTo(oneDay * 2, 5)
  })

  test("每條線一種顏色，點和線是同一色", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`],
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $19990`, `${windforce}(2497MHz), $16990`],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const strokeOf = (code: string): string | null =>
      chart?.querySelector(`line[data-code="${code}"]`)?.getAttribute("stroke") ?? null
    const fillOf = (code: string): string | null =>
      chart?.querySelector(`circle[data-code="${code}"]`)?.getAttribute("fill") ?? null

    expect(strokeOf(prime)).toBe(fillOf(prime))
    expect(strokeOf(windforce)).toBe(fillOf(windforce))
    expect(strokeOf(prime)).not.toBe(strokeOf(windforce))
  })

  test("線末端用和該線相同的顏色標出代號", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`],
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $19990`, `${windforce}(2497MHz), $16990`],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const label = (code: string): Element | undefined =>
      [...(chart?.querySelectorAll("text[data-series-label]") ?? [])].find((item) => item.textContent === code)
    const strokeOf = (code: string): string =>
      chart?.querySelector(`line[data-code="${code}"]`)?.getAttribute("stroke") ?? ""

    expect(label(prime)?.getAttribute("fill")).toBe(strokeOf(prime))
    expect(label(windforce)?.getAttribute("fill")).toBe(strokeOf(windforce))
    expect(strokeOf(prime)).not.toBe(strokeOf(windforce))
  })

  test("選一個品牌後圖上只留那個品牌", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`],
      }]),
    ])
    const open = documentOf(renderPage(series, []))
    const openChart = open.querySelector(`[aria-label="${modelGroup}"]`)
    const openCodes = [...(openChart?.querySelectorAll("[data-code]") ?? [])].map((node) => node.getAttribute("data-code"))
    const brandOptions = [...(openChart?.querySelectorAll('[aria-label="品牌"] button') ?? [])]
      .map((item) => item.textContent)

    expect(new Set(openCodes)).toEqual(new Set([prime, windforce]))
    expect(brandOptions).toEqual(["華碩", "技嘉"])
    const brandRow = openChart?.querySelector('[aria-label="品牌"]')
    expect(brandRow?.classList.contains("flex")).toBe(true)
    expect(brandRow?.classList.contains("flex-wrap")).toBe(true)
    expect(brandRow?.classList.contains("gap-2")).toBe(true)

    const filtered = documentOf(renderPage(series, [{ type: "setBrand", group: modelGroup, name: "華碩" }]))
    const filteredChart = filtered.querySelector(`[aria-label="${modelGroup}"]`)
    const filteredCodes = [...(filteredChart?.querySelectorAll("[data-code]") ?? [])].map((node) => node.getAttribute("data-code"))

    expect(new Set(filteredCodes)).toEqual(new Set([prime]))
    expect(filtered.querySelector('[aria-label="品牌"] button[aria-pressed="true"]')?.textContent).toBe("華碩")
  })

  test("未選品牌時，超過八個代號也全部畫在圖上", () => {
    const codes = Array.from({ length: 9 }, (_, index) => `華碩 CARD-${index}`)
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: codes.map((code, index) => `${code}(1MHz), $${10000 + index}`),
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const shown = [...(doc.querySelector(`[aria-label="${modelGroup}"]`)?.querySelectorAll("[data-code]") ?? [])]
      .map((node) => node.getAttribute("data-code"))

    expect(new Set(shown)).toEqual(new Set(codes))
  })
})
