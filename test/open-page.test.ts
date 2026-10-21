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
  expect(sectionByHeading("價格序列")?.textContent).not.toContain("18990")
  expect(document.querySelector('[aria-label="NVIDIA RTX4070"] [data-price="18990"]')).not.toBeNull()
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

  const point = document.querySelector('[aria-label="折線圖"] [data-date="2024-06-15"]')
  expect(point?.getAttribute("data-code")).toBe("華碩 DUAL-RTX4070-O12G")
  expect(point?.getAttribute("data-price")).toBe("18990")
  const selected = [...document.querySelectorAll('[aria-label="已選"] li span')].map((item) => item.textContent)
  expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])

  const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
  const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
  expect(start?.value).toBe("2023-06-15")
  expect(end?.value).toBe("2024-06-15")
  if (start === null || end === null) {
    return
  }
  start.value = "2023-01-01"
  end.value = "2023-02-01"
  end.dispatchEvent(new Event("change", { bubbles: true }))

  const selectedAfter = [...document.querySelectorAll('[aria-label="已選"] li span')].map((item) => item.textContent)
  expect(selectedAfter).toEqual(["華碩 DUAL-RTX4070-O12G"])
  expect(sectionByHeading("價格序列")?.textContent).not.toContain("18990")
  expect(document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')?.value).toBe("2023-02-01")
})
