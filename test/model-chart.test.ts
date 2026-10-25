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
  test("裝機價和售罄的連線是虛線，一般價是實線", () => {
    const install = "華碩 DUAL-RTX5060-O8G"
    const sold = "技嘉 RTX5060 WINDFORCE OC 8G"
    const regular = "微星 RTX5060 8G VENTUS 2X"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: "NVIDIA RTX5060-8GB",
        rows: [
          `裝機價｛${install}｝2497MHz, $9000`,
          `｛${sold}｝2497MHz 售罄！, $8000`,
          `｛${regular}｝2497MHz, $9500`,
        ],
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: "NVIDIA RTX5060-8GB",
        rows: [
          `裝機價｛${install}｝2497MHz, $9100`,
          `｛${sold}｝2497MHz 售罄！, $8100`,
          `｛${regular}｝2497MHz, $9600`,
        ],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const lines = [...doc.querySelectorAll("svg[data-price-chart] line:not([data-hit])")]
    const dashOf = (code: string) => lines.find((line) => line.getAttribute("data-code") === code)?.getAttribute("stroke-dasharray") ?? ""

    expect(dashOf(install)).toBe("2 1.2")
    expect(dashOf(sold)).toBe("2 1.2")
    expect(dashOf(regular)).toBe("")
  })

  test("下架前的最後一筆是虛線和空心圓，仍標下架前的售價", () => {
    const kept = "華碩 DUAL-RTX5060-O8G"
    const removed = "技嘉 RTX5060 WINDFORCE OC 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: "NVIDIA RTX5060-8GB",
        rows: [
          `｛${kept}｝2497MHz, $10000`,
          `｛${removed}｝2497MHz, $9000`,
        ],
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: "NVIDIA RTX5060-8GB",
        rows: [
          `｛${kept}｝2497MHz, $11000`,
          `｛${removed}｝2497MHz, $9500`,
        ],
      }]),
      snapshot("2024-06-17T02:00:00.000Z", [{
        label: "NVIDIA RTX5060-8GB",
        rows: [`｛${kept}｝2497MHz, $12000`],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector("svg[data-price-chart]")
    const removedPoint = chart?.querySelector(`circle[data-code="${removed}"][data-date="2024-06-16"]`)
    const earlierPoint = chart?.querySelector(`circle[data-code="${removed}"][data-date="2024-06-15"]`)
    const removedLine = chart?.querySelector(`line:not([data-hit])[data-code="${removed}"]`)

    expect(removedPoint?.getAttribute("data-price")).toBe("9500")
    expect(removedPoint?.getAttribute("data-delisted")).toBe("true")
    expect(removedPoint?.getAttribute("fill")).toBe("none")
    expect(earlierPoint?.hasAttribute("data-delisted")).toBe(false)
    expect(earlierPoint?.getAttribute("fill")).not.toBe("none")
    expect(removedLine?.getAttribute("stroke-dasharray")).toBe("2 1.2")
    expect(chart?.querySelector(`circle[data-code="${kept}"][data-delisted]`)?.getAttribute("data-delisted") ?? null).toBeNull()
  })

  test("容量寫成 8G 或 8GB 是同一張圖，容量不同仍分開", () => {
    const eight = "NVIDIA RTX5060-8G"
    const eightGb = "NVIDIA RTX5060-8GB"
    const sixteen = "NVIDIA RTX5060-16GB"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: eight, rows: ["華碩 DUAL-RTX5060-O8G(2497MHz), $9990"] },
        { label: eightGb, rows: ["華碩 TUF-RTX5060-O8G(2497MHz), $10990"] },
        { label: sixteen, rows: ["技嘉 RTX5060 GAMING OC 16G(2497MHz), $14990"] },
      ]),
    ])
    const doc = documentOf(renderPage(series, []))
    const merged = doc.querySelector(`[aria-label="${eightGb}"]`)

    expect(doc.querySelector(`[aria-label="${eight}"]`)).toBeNull()
    expect(merged?.textContent).toContain("華碩 DUAL-RTX5060-O8G")
    expect(merged?.textContent).toContain("華碩 TUF-RTX5060-O8G")
    expect(merged?.querySelector('[data-price="14990"]')).toBeNull()
    expect(doc.querySelector(`[aria-label="${sixteen}"]`)?.textContent).toContain("技嘉 RTX5060 GAMING OC 16G")
  })

  test("選一個品牌後只有該圖留該品牌", () => {
    const group = "NVIDIA RTX5060-8GB"
    const asus = "華碩 DUAL-RTX5060-O8G"
    const gigabyte = "技嘉 RTX5060 WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: "NVIDIA RTX5060-8G", rows: [`${asus}(2497MHz), $9990`] },
        { label: group, rows: [`${gigabyte}(2497MHz), $8990`] },
      ]),
      snapshot("2024-06-16T02:00:00.000Z", [
        { label: "NVIDIA RTX5060-8G", rows: [`${asus}(2497MHz), $10990`] },
        { label: group, rows: [`${gigabyte}(2497MHz), $9890`] },
      ]),
    ])
    const open = documentOf(renderPage(series, []))
    const codesOf = (doc: Document): string[] =>
      [...(doc.querySelector(`[aria-label="${group}"]`)?.querySelectorAll("line:not([data-hit])") ?? [])]
        .map((node) => node.getAttribute("data-code") ?? "")
    expect(new Set(codesOf(open))).toEqual(new Set([asus, gigabyte]))

    const filtered = documentOf(renderPage(series, [{ type: "setBrand", group, name: "華碩" }]))
    expect(codesOf(filtered)).toEqual([asus])
  })

  test("選了晶片分組就只留那一張圖", () => {
    const chosen = "NVIDIA RTX5060-8GB"
    const other = "NVIDIA RTX5090-32GB(GDDR7)"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: "NVIDIA RTX5060-8G", rows: ["華碩 DUAL-RTX5060-O8G(2497MHz), $9990"] },
        { label: other, rows: ["華碩 TUF-RTX5090-O32G(2520MHz), $99990"] },
      ]),
    ])
    const doc = documentOf(renderPage(series, [{ type: "setChipGroup", name: chosen }]))

    expect(doc.querySelector(`[aria-label="${chosen}"]`)).not.toBeNull()
    expect(doc.querySelector('[aria-label="NVIDIA RTX5060-8G"]')).toBeNull()
    expect(doc.querySelector(`[aria-label="${other}"]`)).toBeNull()
  })

  test("沒選分組時只畫 RTX 50 系列，選了其他分組才顯示該圖", () => {
    const older = "NVIDIA RTX4070"
    const fifty = "NVIDIA RTX5090-32GB(GDDR7)"
    const sale = "NVIDIA RTX5070-12GB(GDDR7) 3/5-10點開賣"
    const saleModel = "NVIDIA RTX5070-12GB(GDDR7)"
    const decoy = "NVIDIA RTX3050-8GB"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: older, rows: ["華碩 DUAL-RTX4070-O12G(2535MHz), $18990"] },
        { label: fifty, rows: ["華碩 TUF-RTX5090-O32G-GAMING(2520MHz), $99990"] },
        { label: sale, rows: ["技嘉 RTX5070 GAMING OC 12G(2520MHz), $24990"] },
        { label: decoy, rows: ["微星 RTX3050 VENTUS 2X 8G(1807MHz), $5990"] },
      ]),
    ])
    const open = documentOf(renderPage(series, []))

    expect(open.querySelector(`[aria-label="${fifty}"]`)).not.toBeNull()
    expect(open.querySelector(`[aria-label="${saleModel}"]`)).not.toBeNull()
    expect(open.querySelector(`[aria-label="${sale}"]`)).toBeNull()
    expect(open.querySelector(`[aria-label="${older}"]`)).toBeNull()
    expect(open.querySelector(`[aria-label="${decoy}"]`)).toBeNull()

    const picked = documentOf(renderPage(series, [{ type: "setChipGroup", name: older }]))
    expect(picked.querySelector(`[aria-label="${older}"]`)).not.toBeNull()
    expect(picked.querySelector(`[aria-label="${fifty}"]`)).toBeNull()

    const both = documentOf(renderPage(series, [
      { type: "setChipGroup", name: older },
      { type: "setChipGroup", name: decoy },
    ]))
    expect(both.querySelector(`[aria-label="${older}"]`)).not.toBeNull()
    expect(both.querySelector(`[aria-label="${decoy}"]`)).not.toBeNull()
    expect(both.querySelector(`[aria-label="${fifty}"]`)).toBeNull()
    const marked = [...both.querySelectorAll('[data-slot="select-item"][aria-selected="true"]')]
      .map((item) => item.textContent)
    expect(marked).toEqual([older, decoy])
    expect(both.querySelector('[aria-label="晶片分組"]')?.textContent).toBe(`${older}、${decoy}`)
  })

  test("世代按鈕預設是 50系列，改看 30 或 40 系列時只畫該世代", () => {
    const older = "NVIDIA RTX4070 SUPER 12GB"
    const ti = "NVIDIA RTX4070Ti SUPER 16GB"
    const thirtyLabel = "NVIDIA RTX3060TI"
    const thirty = "NVIDIA RTX3060Ti-8GB(GDDR6)"
    const fifty = "NVIDIA RTX5090-32GB(GDDR7)"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: older, rows: ["華碩 DUAL-RTX4070-O12G(2535MHz), $18990"] },
        { label: ti, rows: ["華碩 TUF-RTX4070TI-O16G(2610MHz), $28990"] },
        { label: thirtyLabel, rows: ["微星 RTX3060 VENTUS 2X 8G(1807MHz), $9990"] },
        { label: fifty, rows: ["華碩 TUF-RTX5090-O32G-GAMING(2520MHz), $99990"] },
      ]),
    ])
    const pressed = (doc: Document): string[] =>
      [...doc.querySelectorAll('[aria-label="世代"] button')]
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => button.textContent ?? "")

    const open = documentOf(renderPage(series, []))
    expect([...open.querySelectorAll('[aria-label="世代"] button')].map((button) => button.textContent)).toEqual([
      "30系列",
      "40系列",
      "50系列",
    ])
    expect(pressed(open)).toEqual(["50系列"])
    expect(open.querySelector(`[aria-label="${fifty}"]`)).not.toBeNull()
    expect(open.querySelector(`[aria-label="${older}"]`)).toBeNull()
    expect(open.querySelector(`[aria-label="${thirty}"]`)).toBeNull()

    const forty = documentOf(renderPage(series, [{ type: "setGeneration", name: "40" }]))
    expect(pressed(forty)).toEqual(["40系列"])
    expect(forty.querySelector(`[aria-label="${older}"]`)).not.toBeNull()
    expect(forty.querySelector(`[aria-label="${ti}"]`)).not.toBeNull()
    expect(forty.querySelector(`[aria-label="${fifty}"]`)).toBeNull()
    expect(forty.querySelector(`[aria-label="${thirty}"]`)).toBeNull()

    const picked = documentOf(renderPage(series, [{ type: "setGeneration", name: "30" }]))
    expect(pressed(picked)).toEqual(["30系列"])
    expect(picked.querySelector(`[aria-label="${thirty}"]`)).not.toBeNull()
    expect(picked.querySelector(`[aria-label="${older}"]`)).toBeNull()
    expect(picked.querySelector(`[aria-label="${fifty}"]`)).toBeNull()
  })

  test("另一張分組圖也把缺日前後的日報價連起來", () => {
    const twelveG = "NVIDIA RTX5070-12GB"
    const code = "華碩 DUAL-RTX4070-O12G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $18990`] }]),
      snapshot("2024-06-17T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $17990`] }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${twelveG}"]`)

    expect(chart?.querySelectorAll("line:not([data-hit])")).toHaveLength(1)
    expect(chart?.querySelector("[data-date='2024-06-16']")).toBeNull()
    expect(chart?.textContent).not.toContain("2024-06-16")
  })

  test("圖上有背景、日期軸、金額軸和格線", () => {
    const twelveG = "NVIDIA RTX5070-12GB"
    const code = "華碩 DUAL-RTX4070-O12G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $18990`] }]),
      snapshot("2024-06-16T02:00:00.000Z", [{ label: twelveG, rows: [`${code}(2535MHz), $17990`] }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const svg = doc.querySelector(`[aria-label="${twelveG}"] svg`)
    const yTexts = [...(svg?.querySelectorAll('text[data-axis="y"]') ?? [])].map((node) => node.textContent ?? "")
    const yLabels = yTexts.map((text) => Number(text.replaceAll("$", "").replaceAll(",", "")))
    const prices = [...yLabels].sort((left, right) => left - right)
    const lastPoint = svg?.querySelector('[data-date="2024-06-16"]')
    const name = [...(svg?.querySelectorAll("text[data-series-label]") ?? [])].find((node) => node.textContent === code)

    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 100")
    expect(svg?.getAttribute("style")).toContain("aspect-ratio:4/1")
    expect(svg?.querySelector('[data-axis="background"]')?.getAttribute("fill")).toBe("#e8eef7")
    expect(svg?.querySelector('[data-axis="x"]')).not.toBeNull()
    const background = svg?.querySelector('[data-axis="background"]')
    const plotEdge = Number(background?.getAttribute("x")) + Number(background?.getAttribute("width"))
    const yAxis = svg?.querySelector('[data-axis="y"]')
    const yLabel = svg?.querySelector('text[data-axis="y"]')
    const axisX = Number(/^M([\d.]+)/.exec(yAxis?.getAttribute("d") ?? "")?.[1])
    expect(yAxis).not.toBeNull()
    expect(axisX).toBe(plotEdge)
    expect(Number(yLabel?.getAttribute("x"))).toBeGreaterThan(axisX)
    expect(Number(name?.getAttribute("x"))).toBeGreaterThan(Number(yLabel?.getAttribute("x")))
    expect(svg?.querySelector('[data-axis="grid"]')).not.toBeNull()
    expect([...(svg?.querySelectorAll('text[data-axis="x"]') ?? [])].map((node) => node.textContent)).toEqual([])
    expect(prices).toHaveLength(11)
    expect(prices[0]).toBe(Math.round(17990 * 0.95))
    expect(prices[10]).toBe(Math.round(18990 * 1.05))
    expect(yTexts).toContain("$17,091")
    expect(yTexts).toContain("$19,940")
    expect(Number(name?.getAttribute("x"))).toBeGreaterThan(Number(lastPoint?.getAttribute("cx")))
    expect(svg?.querySelector('[aria-label="圖例"]')).toBeNull()
  })

  test("第一個月份不完整時不標該月，從月初開始的月份仍會標", () => {
    const group = "NVIDIA RTX5070-12GB"
    const code = "華碩 DUAL-RTX4070-O12G"
    const row = (price: number): string => `${code}(2535MHz), $${price}`
    const partial = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: group, rows: [row(18990)] }]),
      snapshot("2024-08-02T02:00:00.000Z", [{ label: group, rows: [row(17990)] }]),
    ])
    const partialLabels = [...documentOf(renderPage(partial, [])).querySelectorAll(`[aria-label="${group}"] text[data-axis="x"]`)]
      .map((node) => node.textContent)
    expect(partialLabels).toEqual(["2024-07"])

    const full = update(emptySeries(), [
      snapshot("2024-06-01T02:00:00.000Z", [{ label: group, rows: [row(18990)] }]),
      snapshot("2024-07-31T02:00:00.000Z", [{ label: group, rows: [row(17990)] }]),
    ])
    const fullNodes = [...documentOf(renderPage(full, [])).querySelectorAll(`[aria-label="${group}"] text[data-axis="x"]`)]
    expect(fullNodes.map((node) => node.textContent)).toEqual(["2024-06", "2024-07"])
    expect(fullNodes.map((node) => node.getAttribute("text-anchor"))).toEqual(["middle", "middle"])
  })

  test("首月至少 14 日才標下個月，末月至少 14 日才標末月", () => {
    const group = "NVIDIA RTX5070-12GB"
    const code = "華碩 DUAL-RTX4070-O12G"
    const row = (price: number): string => `${code}(2535MHz), $${price}`
    const labels = (start: string, end: string): (string | null)[] => {
      const series = update(emptySeries(), [
        snapshot(`${start}T02:00:00.000Z`, [{ label: group, rows: [row(18990)] }]),
        snapshot(`${end}T02:00:00.000Z`, [{ label: group, rows: [row(17990)] }]),
      ])
      return [...documentOf(renderPage(series, [])).querySelectorAll(`[aria-label="${group}"] text[data-axis="x"]`)]
        .map((node) => node.textContent)
    }

    expect(labels("2024-06-17", "2024-09-30")).toEqual(["2024-07", "2024-08", "2024-09"])
    expect(labels("2024-06-18", "2024-09-30")).toEqual(["2024-08", "2024-09"])
    expect(labels("2024-06-01", "2024-09-14")).toEqual(["2024-06", "2024-07", "2024-08", "2024-09"])
    expect(labels("2024-06-01", "2024-09-13")).toEqual(["2024-06", "2024-07", "2024-08"])
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
    expect(doc.querySelector('[aria-label="NVIDIA RTX4070"]')).toBeNull()
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
    expect(chart?.querySelectorAll("line:not([data-hit])")).toHaveLength(2)
    expect(chart?.querySelector("[data-date='2024-06-17']")).toBeNull()
    expect(chart?.textContent).not.toContain("2024-06-17")
    expect(twoDays).toBeCloseTo(oneDay * 2, 5)
  })

  test("一個品牌一種顏色，點和線是同一色", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const tuf = "華碩 TUF-RTX5060TI-8G"
    const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $18990`, `${tuf}(2565MHz), $19990`, `${windforce}(2497MHz), $17990`],
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $19990`, `${tuf}(2565MHz), $20990`, `${windforce}(2497MHz), $16990`],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const strokeOf = (code: string): string | null =>
      chart?.querySelector(`line[data-code="${code}"]`)?.getAttribute("stroke") ?? null
    const fillOf = (code: string): string | null =>
      chart?.querySelector(`circle[data-code="${code}"]`)?.getAttribute("fill") ?? null

    expect(strokeOf(prime)).toBe(fillOf(prime))
    expect(strokeOf(tuf)).toBe(fillOf(tuf))
    expect(strokeOf(windforce)).toBe(fillOf(windforce))
    expect(strokeOf(prime)).toBe(strokeOf(tuf))
    expect(strokeOf(prime)).not.toBe(strokeOf(windforce))
  })

  test("同一品牌在每張圖和品牌按鈕上都是同一個顏色", () => {
    const asus = "華碩 PRIME-RTX5060TI-8G"
    const gigabyte = "技嘉 RTX5060Ti WINDFORCE 8G"
    const gigabyte5090 = "技嘉 RTX5090 GAMING OC 32G"
    const onlyGigabyte = "NVIDIA RTX5090"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [
        { label: modelGroup, rows: [`${asus}(2505MHz), $18990`, `${gigabyte}(2497MHz), $17990`] },
        { label: onlyGigabyte, rows: [`${gigabyte5090}(2520MHz), $99990`] },
      ]),
      snapshot("2024-06-16T02:00:00.000Z", [
        { label: modelGroup, rows: [`${asus}(2505MHz), $19990`, `${gigabyte}(2497MHz), $16990`] },
        { label: onlyGigabyte, rows: [`${gigabyte5090}(2520MHz), $98990`] },
      ]),
    ])
    const doc = documentOf(renderPage(series, []))
    const strokeOf = (group: string, code: string): string | null =>
      doc.querySelector(`[aria-label="${group}"] line[data-code="${code}"]`)?.getAttribute("stroke") ?? null
    const swatch = (group: string, name: string): string => {
      const button = [...(doc.querySelectorAll(`[aria-label="${group}"] [aria-label="品牌"] button`) ?? [])]
        .find((node) => node.textContent === name)
      return button?.querySelector("span[aria-hidden]")?.getAttribute("style") ?? ""
    }

    expect(strokeOf(modelGroup, gigabyte)).toBe(strokeOf(onlyGigabyte, gigabyte5090))
    expect(swatch(modelGroup, "技嘉")).toContain(strokeOf(modelGroup, gigabyte) ?? "")
    expect(swatch(onlyGigabyte, "技嘉")).toBe(swatch(modelGroup, "技嘉"))
    expect(swatch(modelGroup, "華碩")).not.toBe(swatch(modelGroup, "技嘉"))
  })

  test("五個主要品牌各一色，其餘品牌合併為其他", () => {
    const cards = [
      ["華碩 CARD", "#58c65b"],
      ["技嘉 CARD", "#5b58c6"],
      ["微星 CARD", "#c65b58"],
      ["INNO3D CARD", "#42bdbb"],
      ["ZOTAC CARD", "#bb42bd"],
      ["藍寶石 CARD", "#bdbb42"],
      ["華擎 CARD", "#bdbb42"],
    ] as const
    const row = (code: string, price: number): string => `${code}(2497MHz), $${price}`
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: cards.map(([code], index) => row(code, 10000 + index)),
      }]),
      snapshot("2024-06-16T02:00:00.000Z", [{
        label: modelGroup,
        rows: cards.map(([code], index) => row(code, 11000 + index)),
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const chart = doc.querySelector(`[aria-label="${modelGroup}"]`)
    const strokeOf = (code: string): string | null =>
      chart?.querySelector(`line[data-code="${code}"]`)?.getAttribute("stroke") ?? null
    const swatch = (name: string): string => {
      const button = [...(chart?.querySelectorAll('[aria-label="品牌"] button') ?? [])]
        .find((node) => node.textContent === name)
      return button?.querySelector("span[aria-hidden]")?.getAttribute("style") ?? ""
    }
    const names = [...(chart?.querySelectorAll('[aria-label="品牌"] button') ?? [])].map((node) => node.textContent)

    expect(names).toEqual(["華碩", "技嘉", "微星", "INNO3D", "ZOTAC", "其他"])
    for (const [code, color] of cards) {
      expect(strokeOf(code)).toBe(color)
    }
    expect(swatch("華碩")).toContain("#58c65b")
    expect(swatch("其他")).toContain("#bdbb42")
    expect(strokeOf("藍寶石 CARD")).toBe(strokeOf("華擎 CARD"))

    const filtered = documentOf(renderPage(series, [{ type: "setBrand", group: modelGroup, name: "其他" }]))
    const codes = [...(filtered.querySelector(`[aria-label="${modelGroup}"]`)?.querySelectorAll("line:not([data-hit])") ?? [])]
      .map((node) => node.getAttribute("data-code"))
    expect(codes).toEqual(["藍寶石 CARD", "華擎 CARD"])
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

  test("售價相同的型號名稱會上下錯開", () => {
    const prime = "華碩 PRIME-RTX5060TI-8G"
    const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{
        label: modelGroup,
        rows: [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $18990`],
      }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const labels = [...(doc.querySelector(`[aria-label="${modelGroup}"]`)?.querySelectorAll("text[data-series-label]") ?? [])]
    const ys = labels.map((label) => Number(label.getAttribute("y"))).sort((left, right) => left - right)
    const size = Number(labels[0]?.getAttribute("font-size"))

    expect(ys).toHaveLength(2)
    expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeGreaterThanOrEqual(size)
  })

  test("型號很多時縮小字級，名稱仍不重疊", () => {
    const rows = Array.from({ length: 40 }, (_, index) => `廠牌${index} 型號${index}(1000MHz), $18990`)
    const series = update(emptySeries(), [
      snapshot("2024-06-15T02:00:00.000Z", [{ label: modelGroup, rows }]),
    ])
    const doc = documentOf(renderPage(series, []))
    const labels = [...(doc.querySelector(`[aria-label="${modelGroup}"]`)?.querySelectorAll("text[data-series-label]") ?? [])]
    const ys = labels.map((label) => Number(label.getAttribute("y"))).sort((left, right) => left - right)
    const size = Number(labels[0]?.getAttribute("font-size"))
    const gaps = ys.slice(1).map((y, index) => y - (ys[index] ?? y))

    expect(labels).toHaveLength(40)
    expect(size).toBeLessThan(3.2)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(size)
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
