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

test("點開品牌並選華碩後，圖上只留華碩的線", () => {
  const series = update(emptySeries(), [
    vga("2024-06-15T02:00:00.000Z", [`${prime}(2505MHz), $18990`, `${windforce}(2497MHz), $17990`]),
  ])
  start(series)

  const content = document.querySelector('[aria-label="品牌"]')
    ?.closest('[data-slot="select"]')
    ?.querySelector('[data-slot="select-content"]')
  expect(content?.classList.contains("hidden")).toBe(true)
  document.querySelector<HTMLElement>('[aria-label="品牌"]')?.click()
  expect(content?.classList.contains("hidden")).toBe(false)

  const item = [...(content?.querySelectorAll<HTMLElement>('[data-slot="select-item"]') ?? [])]
    .find((node) => node.textContent === "華碩")
  item?.click()

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
