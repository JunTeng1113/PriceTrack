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

test("點線末端的名稱時其他線變半透明，再點一次恢復", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
  ])
  start(series)

  const name = (): Element | undefined =>
    [...document.querySelectorAll(`[aria-label="${modelGroup}"] text[data-series-label]`)]
      .find((node) => node.textContent === prime)
  const opacity = (code: string): string | null =>
    document.querySelector(`[aria-label="${modelGroup}"] circle[data-code="${code}"]`)?.getAttribute("opacity") ?? null
  name()?.dispatchEvent(new MouseEvent("click", { bubbles: true }))

  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("0.25")
  expect(name()?.getAttribute("data-focused")).toBe("true")

  name()?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  expect(opacity(prime)).toBe("1")
  expect(opacity(windforce)).toBe("1")
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
