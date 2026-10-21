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

test("訪客打開頁面、用晶片分組加入已選", () => {
  expect(document.documentElement.lang).toBe("zh-Hant")
  expect(document.querySelector('input[aria-label="關鍵字"]')).toBeNull()
  expect(document.body.textContent).not.toContain("已選")
  expect(sectionByHeading("價格序列")).toBeNull()
  expect(document.querySelector('[aria-label="NVIDIA RTX4070"]')).toBeNull()
  expect(document.documentElement.innerHTML.toLowerCase()).not.toContain("archive.org")
  expect(document.documentElement.innerHTML.toLowerCase()).not.toContain("wayback")

  expect(sectionByHeading("篩選")).not.toBeNull()

  expect(document.querySelector('[aria-label="候選"] button')).toBeNull()
  const group = [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
    .find((item) => item.textContent === "NVIDIA RTX4070")
  group?.click()
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()

  const button = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(button?.textContent).toBe("華碩 DUAL-RTX4070-O12G")
  button?.click()

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
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()

  const selectedAfter = [...document.querySelectorAll('[aria-label="已選"] li span')].map((item) => item.textContent)
  expect(selectedAfter).toEqual(["華碩 DUAL-RTX4070-O12G"])
  expect(sectionByHeading("價格序列")).toBeNull()
  expect(document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')?.value).toBe("2023-02-01")
})
