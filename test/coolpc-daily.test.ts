import { describe, expect, test } from "vitest"
import { ingestCoolpc, nextCheck, siteCapturedAt, type PreparedSeries } from "../src/coolpc-daily.ts"

function atUtc(iso: string): Date {
  return new Date(iso)
}

const page = `
  2026/10/24 18:05<span style="font-family:'Segoe UI Symbol'">&#xe1db;</span>
  2026/10/24 18:06:28
  顯示卡VGA
  <select name="n12">
    <optgroup label="NVIDIA RTX5090">
      <option>華碩 TUF-RTX5090(2520MHz), $99990</option>
    </optgroup>
  </select>
`

describe("每六小時", () => {
  test("這一次檢查完，六小時後再檢查", () => {
    expect(nextCheck(atUtc("2026-10-24T09:59:00.000Z")).toISOString()).toBe("2026-10-24T15:59:00.000Z")
    expect(nextCheck(atUtc("2026-10-24T22:30:00.000Z")).toISOString()).toBe("2026-10-25T04:30:00.000Z")
  })

  test("更新時間用頁面上的標記，不採用秒數時鐘", () => {
    expect(siteCapturedAt(page)).toBe("2026-10-24T10:05:00.000Z")
    expect(siteCapturedAt("2026/10/24 18:06:28 顯示卡VGA")).toBeNull()
  })

  test("同一份快照不重複寫入", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    const saved = ingestCoolpc(empty, page)
    expect(saved.result).toEqual({
      status: "saved",
      capturedAt: "2026-10-24T10:05:00.000Z",
      quotes: 1,
    })

    expect(saved.prepared.quotes[0]?.source).toBe("估價頁")

    const again = ingestCoolpc(saved.prepared, page)
    expect(again.result).toEqual({ status: "already", capturedAt: "2026-10-24T10:05:00.000Z" })
    expect(again.prepared.quotes).toHaveLength(1)
  })

  test("沒有顯示卡或沒有更新時間時不寫入", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    expect(ingestCoolpc(empty, "2026/10/24 18:05<span>&#xe1db;</span>").result.status).toBe("not-vga")
    expect(ingestCoolpc(empty, "顯示卡VGA<select></select>").result.status).toBe("no-stamp")
  })
})
