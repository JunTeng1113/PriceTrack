// @vitest-environment happy-dom

import { expect, test } from "vitest"
import "../src/main.ts"

function sectionByHeading(heading: string): HTMLElement | null {
  const headings = [...document.querySelectorAll("h2")]
  const found = headings.find((node) => node.textContent === heading)
  if (found === undefined || found.parentElement === null) {
    return null
  }
  return found.parentElement
}

test("訪客打開頁面、用關鍵字加入已選", () => {
  expect(document.documentElement.lang).toBe("zh-Hant")
  expect(document.body.textContent).toContain("關鍵字")
  expect(document.body.textContent).toContain("已選")
  expect(document.body.textContent).not.toContain("18990")
  expect(document.documentElement.innerHTML.toLowerCase()).not.toContain("archive.org")
  expect(document.documentElement.innerHTML.toLowerCase()).not.toContain("wayback")

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

  const button = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(button?.textContent).toBe("華碩 DUAL-RTX4070-O12G")
  button?.click()

  const point = sectionByHeading("價格序列")?.querySelector("li")
  expect(point?.textContent).toContain("2024-06-15")
  expect(point?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
  expect(point?.textContent).toContain("18990")
  const selected = [...document.querySelectorAll('[aria-label="已選"] li')].map((item) => item.textContent)
  expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
})
