// @vitest-environment happy-dom

import { expect, test } from "vitest"
import { start } from "../src/browse.ts"
import { emptySeries, update, type Snapshot } from "../src/present.ts"

const modelGroup = "NVIDIA RTX5060Ti-8GB(GDDR7)"
const prime = "華碩 PRIME-RTX5060TI-8G"
const windforce = "技嘉 RTX5060Ti WINDFORCE 8G"

function vga(capturedAt: string, rows: readonly string[]): Snapshot {
  const options = rows.map((row) => `<option>${row}</option>`).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <optgroup label="${modelGroup}">${options}</optgroup>
          </select>
        </td>
      </tr>
    `,
  }
}

test("點品牌按鈕後，圖上只留該品牌的線", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
  ])
  start(series)

  const button = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')]
    .find((node) => node.textContent === "華碩")
  expect(button?.getAttribute("data-slot")).toBe("button")
  expect(button?.getAttribute("aria-pressed")).toBe("false")
  const marker = document.createElement("p")
  marker.id = "keep"
  document.body.append(marker)
  button?.click()

  const codes = (): string[] =>
    [...document.querySelectorAll(`[aria-label="${modelGroup}"] [data-code]`)]
      .map((node) => node.getAttribute("data-code") ?? "")
  expect(new Set(codes())).toEqual(new Set([prime]))
  expect(button?.getAttribute("aria-pressed")).toBe("true")
  expect(document.getElementById("keep")).not.toBeNull()

  button?.click()
  expect(new Set(codes())).toEqual(new Set([prime, windforce]))
  expect(button?.getAttribute("aria-pressed")).toBe("false")
  expect(document.getElementById("keep")).not.toBeNull()
})

test("品牌可以複選，再點一次就取消", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
  ])
  start(series)

  const button = (name: string): HTMLButtonElement | undefined =>
    [...document.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')]
      .find((node) => node.textContent === name)
  const codes = (): string[] =>
    [...document.querySelectorAll(`[aria-label="${modelGroup}"] [data-code]`)]
      .map((node) => node.getAttribute("data-code") ?? "")

  button("華碩")?.click()
  button("技嘉")?.click()
  expect(button("華碩")?.getAttribute("aria-pressed")).toBe("true")
  expect(button("技嘉")?.getAttribute("aria-pressed")).toBe("true")
  expect(new Set(codes())).toEqual(new Set([prime, windforce]))

  button("華碩")?.click()
  expect(button("華碩")?.getAttribute("aria-pressed")).toBe("false")
  expect(button("技嘉")?.getAttribute("aria-pressed")).toBe("true")
  expect(new Set(codes())).toEqual(new Set([windforce]))
})

test("滑鼠移到線上時，頁面不重畫", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`]),
    vga("2024-06-16T02:00:00.000Z", [`${prime}(2505MHz), $11000`]),
  ])
  start(series)

  const line = document.querySelector<SVGLineElement>(`[aria-label="${modelGroup}"] line[data-code="${prime}"]`)
  expect(line).not.toBeNull()
  const marker = document.createElement("p")
  marker.id = "keep"
  document.body.append(marker)
  line?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector('[aria-label="讀數"]')).toBeNull()
  expect(document.getElementById("keep")).not.toBeNull()
})

test("滑鼠沒停在折線上時，不 focus 任何一條線", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $19990`, `${windforce}(2497MHz), $16990`]),
  ])
  start(series)

  const svg = document.querySelector(`[aria-label="${modelGroup}"] svg`)
  const name = (): Element | undefined =>
    [...document.querySelectorAll(`[aria-label="${modelGroup}"] text[data-series-label]`)]
      .find((node) => node.textContent === prime)
  const opacity = (code: string): string | null =>
    document.querySelector(`[aria-label="${modelGroup}"] circle[data-code="${code}"]`)?.getAttribute("opacity") ?? null
  const line = svg?.querySelector(`line[data-hit="true"][data-code="${prime}"]`)
  const gap = svg?.querySelector(`[data-day="2024-06-16"][data-code="${prime}"]`)

  line?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(opacity(windforce)).toBe("0.25")

  line?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: name() ?? null }))
  expect(opacity(windforce)).toBe("0.25")
  expect(name()?.getAttribute("data-focused")).toBe("true")

  name()?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("1")
  expect(name()?.getAttribute("data-focused")).toBe("false")

  name()?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  gap?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("1")
})

test("滑鼠停在型號名稱上時 focus 該折線", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $19990`, `${windforce}(2497MHz), $16990`]),
  ])
  start(series)

  const marker = document.createElement("p")
  marker.id = "keep"
  document.body.append(marker)
  const name = (code: string): Element | undefined =>
    [...document.querySelectorAll(`[aria-label="${modelGroup}"] text[data-series-label]`)]
      .find((node) => node.textContent === code)
  const opacity = (code: string): string | null =>
    document.querySelector(`[aria-label="${modelGroup}"] circle[data-code="${code}"]`)?.getAttribute("opacity") ?? null

  name(prime)?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(name(prime)?.getAttribute("data-focused")).toBe("true")
  expect(name(windforce)?.getAttribute("data-focused")).toBe("false")
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("0.25")

  name(windforce)?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(name(windforce)?.getAttribute("data-focused")).toBe("true")
  expect(opacity(prime)).toBe("0.25")
  expect(opacity(windforce)).toBe("1")

  name(windforce)?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
  expect(name(windforce)?.getAttribute("data-focused")).toBe("false")
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("1")
  expect(document.getElementById("keep")).not.toBeNull()
})

test("滑鼠移到一條線上時其他線變半透明，移開就恢復", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`, `${windforce}(2497MHz), $20000`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $13000`, `${windforce}(2497MHz), $22000`]),
  ])
  start(series)

  const svg = document.querySelector(`[aria-label="${modelGroup}"] svg`)
  expect(svg).not.toBeNull()
  if (svg === null) {
    return
  }
  const opacity = (code: string): string | null =>
    svg.querySelector(`line[data-code="${code}"]`)?.getAttribute("opacity") ?? null
  const primeLine = svg.querySelector(`line[data-code="${prime}"]`)
  const otherLine = svg.querySelector(`line[data-code="${windforce}"]`)
  primeLine?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("0.25")

  otherLine?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  expect(opacity(windforce)).toBe("1")
  expect(opacity(prime)).toBe("0.25")

  primeLine?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("1")
})

test("每一條折線懸停都會出現 Tooltip", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`, `${windforce}(2497MHz), $20000`]),
    vga("2024-06-16T02:00:00.000Z", [`${prime}(2505MHz), $11000`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $13000`, `${windforce}(2497MHz), $22000`]),
  ])
  start(series)

  const svg = document.querySelector(`[aria-label="${modelGroup}"] svg`)
  const gaps = [...(svg?.querySelectorAll("[data-day]") ?? [])]
  expect(gaps.length).toBeGreaterThan(0)
  for (const gap of gaps) {
    expect(gap.getAttribute("pointer-events")).toBe("none")
  }

  for (const code of [prime, windforce]) {
    const line = svg?.querySelector(`line[data-hit="true"][data-code="${code}"]`)
    expect(line).not.toBeNull()
    line?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 40, clientY: 40 }))
    const rows = [...document.querySelectorAll('[role="tooltip"] p')].map((node) => node.textContent ?? "")
    expect(document.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(false)
    expect(rows[1]).toBe(code)
  }
})

test("滑鼠停在折線上時，Tooltip 顯示日期、型號名稱與價格", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`, `${windforce}(2497MHz), $20000`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $13000`, `${windforce}(2497MHz), $22000`]),
  ])
  start(series)

  const svg = document.querySelector(`[aria-label="${modelGroup}"] svg`)
  const line = svg?.querySelector(`line[data-hit="true"][data-code="${prime}"]`)
  const rows = (): string[] =>
    [...document.querySelectorAll('[role="tooltip"] p')].map((node) => node.textContent ?? "")

  line?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 30, clientY: 40 }))
  expect(document.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(false)
  expect(rows()).toEqual([line?.getAttribute("data-to-date"), prime, "$13,000"])

  const point = svg?.querySelector(`circle[data-date="2024-06-15"][data-code="${prime}"]`)
  point?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 20, clientY: 20 }))
  expect(rows()).toEqual(["2024-06-15", prime, "$10,000"])

  point?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
  expect(document.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(true)
})

test("下架的最後一筆在 Tooltip 標明下架", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`, `${windforce}(2497MHz), $20000`]),
    vga("2024-06-16T02:00:00.000Z", [`${prime}(2505MHz), $11000`]),
  ])
  start(series)

  const svg = document.querySelector(`[aria-label="${modelGroup}"] svg`)
  const removed = svg?.querySelector(`circle[data-code="${windforce}"][data-delisted="true"]`)
  removed?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 40, clientY: 40 }))
  const removedRows = [...document.querySelectorAll('[role="tooltip"] p')].map((node) => node.textContent ?? "")
  expect(removedRows).toEqual(["2024-06-15", windforce, "$20,000", "下架"])

  const kept = svg?.querySelector(`circle[data-code="${prime}"][data-date="2024-06-16"]`)
  kept?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 80, clientY: 40 }))
  const keptRows = [...document.querySelectorAll('[role="tooltip"] p')].map((node) => node.textContent ?? "")
  expect(keptRows).toEqual(["2024-06-16", prime, "$11,000"])
})

test("晶片分組可以複選，搜尋後留下勾選的圖", () => {
  const fifty = "NVIDIA RTX5090"
  const older = "NVIDIA RTX4070"
  const other = "NVIDIA RTX3060"
  const html = `
    <tr>
      <td>顯示卡VGA</td>
      <td>
        <select name="n12">
          <optgroup label="${fifty}"><option>華碩 TUF-RTX5090(2520MHz), $99990</option></optgroup>
          <optgroup label="${older}"><option>華碩 DUAL-RTX4070-O12G(2535MHz), $18990</option></optgroup>
          <optgroup label="${other}"><option>華碩 DUAL-RTX3060-O8G(1807MHz), $9990</option></optgroup>
          <optgroup label="AMD RX6800"><option>華碩 Radeon RX6800-16G(1800MHz), $19990</option></optgroup>
        </select>
      </td>
    </tr>
  `
  start(update(emptySeries(), [{ capturedAt: "2024-06-15T02:00:00.000Z", html }]))

  const item = (name: string): HTMLElement | undefined =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
      .find((node) => node.textContent === name)
  const vendor = (name: string): HTMLButtonElement | undefined =>
    [...document.querySelectorAll<HTMLButtonElement>('[aria-label="晶片廠"] button')]
      .find((node) => node.textContent === name)

  expect(document.querySelector('[aria-label="晶片廠"]')?.closest("label")).toBeNull()
  expect(vendor("NVIDIA")?.getAttribute("aria-pressed")).toBe("true")
  expect(item(older)?.classList.contains("hidden")).toBe(false)
  expect(item("AMD RX6800")?.classList.contains("hidden")).toBe(true)
  vendor("NVIDIA")?.click()
  expect(vendor("NVIDIA")?.getAttribute("aria-pressed")).toBe("true")
  expect(vendor("NVIDIA")?.className).toContain("aria-pressed:bg-slate-900")

  document.querySelector<HTMLElement>('[data-slot="select-trigger"]')?.click()
  item(older)?.click()
  item(other)?.click()
  expect(vendor("NVIDIA")?.getAttribute("aria-pressed")).toBe("true")
  expect(item(older)?.getAttribute("aria-selected")).toBe("true")
  expect(item(other)?.getAttribute("aria-selected")).toBe("true")

  expect(document.querySelector('[data-slot="select-content"]')?.classList.contains("hidden")).toBe(false)
  expect(document.querySelector('[aria-label="晶片分組"]')?.textContent).toBe(`${older}、${other}`)
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()

  expect(document.querySelector(`[aria-label="${older}"]`)).not.toBeNull()
  expect(document.querySelector(`[aria-label="${other}"]`)).not.toBeNull()
  expect(document.querySelector(`[aria-label="${fifty}"]`)).toBeNull()

  document.querySelector<HTMLElement>('[data-slot="select-trigger"]')?.click()
  item(other)?.click()
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()

  expect(document.querySelector(`[aria-label="${older}"]`)).not.toBeNull()
  expect(document.querySelector(`[aria-label="${other}"]`)).toBeNull()
})
