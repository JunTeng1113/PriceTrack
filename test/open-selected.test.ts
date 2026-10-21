// @vitest-environment happy-dom

import { expect, test } from "vitest"
import "../src/main.ts"

function sectionByHeading(heading: string): HTMLElement | null {
  const found = [...document.querySelectorAll("h2")].find((node) => node.textContent === heading)
  if (found === undefined || found.parentElement === null) {
    return null
  }
  return found.parentElement
}

test("拿掉已選、取消候選勾選，並點圖上的點讀數", () => {
  expect(localStorage.length).toBe(0)
  expect(document.body.textContent).not.toContain("登入")
  expect(document.body.textContent).not.toContain("收藏")
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)

  const filter = sectionByHeading("篩選")
  const chart = sectionByHeading("價格序列")
  expect(filter).not.toBeNull()
  expect(chart).not.toBeNull()
  if (filter !== null && chart !== null) {
    expect(filter.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  }

  const input = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
  expect(input).not.toBeNull()
  if (input === null) {
    return
  }
  input.value = "dual-rtx4070"
  input.dispatchEvent(new Event("input", { bubbles: true }))
  document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')?.click()

  expect(document.querySelector('[aria-label="已選"] li span')?.textContent).toBe("華碩 DUAL-RTX4070-O12G")
  expect(document.querySelector('[aria-label="折線圖"] [data-price="18990"]')).not.toBeNull()

  document.querySelector<HTMLButtonElement>('[aria-label="已選"] button')?.click()
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)
  expect(sectionByHeading("價格序列")?.textContent).not.toContain("18990")

  const candidate = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(candidate?.getAttribute("aria-pressed")).toBe("false")
  candidate?.click()

  const point = document.querySelector<SVGElement>('[aria-label="折線圖"] [data-date="2024-06-15"]')
  point?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  const readout = document.querySelector('[aria-label="讀數"]')
  expect(readout?.textContent).toContain("2024-06-15")
  expect(readout?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
  expect(readout?.textContent).toContain("18990")

  const checked = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(checked?.getAttribute("aria-pressed")).toBe("true")
  checked?.click()
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)
  expect(document.querySelector('[aria-label="讀數"]')?.textContent).toBe("")
  expect(localStorage.length).toBe(0)
})
