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
  button?.click()

  const codes = [...document.querySelectorAll(`[aria-label="${modelGroup}"] [data-code]`)]
    .map((node) => node.getAttribute("data-code"))
  expect(new Set(codes)).toEqual(new Set([prime]))
})

test("在型號圖上指向缺日，讀出該線較近的售價", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`, `${windforce}(2497MHz), $20000`]),
    vga("2024-06-18T02:00:00.000Z", [`${prime}(2505MHz), $13000`, `${windforce}(2497MHz), $22000`]),
  ])
  start(series)

  const mark = document.querySelector<SVGElement>(
    `[aria-label="${modelGroup}"] [data-day="2024-06-17"][data-code="${prime}"]`,
  )
  expect(mark).not.toBeNull()
  mark?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector(`[aria-label="${modelGroup}"] [aria-label="讀數"]`)?.textContent).toBe(
    `2024-06-18 ${prime} 13000`,
  )
})

test("滑鼠移到線上時，讀出日期、名稱與價錢", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $10000`]),
    vga("2024-06-16T02:00:00.000Z", [`${prime}(2505MHz), $11000`]),
  ])
  start(series)

  const line = document.querySelector<SVGLineElement>(`[aria-label="${modelGroup}"] line[data-code="${prime}"]`)
  expect(line).not.toBeNull()
  line?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector(`[aria-label="${modelGroup}"] [aria-label="讀數"]`)?.textContent).toBe(
    `2024-06-16 ${prime} 11000`,
  )
})
