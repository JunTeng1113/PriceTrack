import { describe, expect, test } from "vitest"
import { ingestCoolpc, ingestMemory, changesAgainstPrevious, nextCheck, siteCapturedAt, type PreparedSeries } from "../src/coolpc-daily.ts"

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
    expect(siteCapturedAt(page)).toBe("2026-10-24T18:05:00")
    expect(siteCapturedAt("2026/10/24 18:06:28 顯示卡VGA")).toBeNull()
  })

  test("同一份快照不重複寫入", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    const saved = ingestCoolpc(empty, page)
    expect(saved.result).toEqual({
      status: "saved",
      capturedAt: "2026-10-24T18:05:00",
      quotes: 1,
    })

    expect(saved.prepared.quotes[0]?.source).toBe("估價頁")

    const again = ingestCoolpc(saved.prepared, page)
    expect(again.result).toEqual({ status: "already", capturedAt: "2026-10-24T18:05:00" })
    expect(again.prepared.quotes).toHaveLength(1)
  })

  test("沒有顯示卡或沒有更新時間時不寫入", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    expect(ingestCoolpc(empty, "2026/10/24 18:05<span>&#xe1db;</span>").result.status).toBe("not-vga")
    expect(ingestCoolpc(empty, "顯示卡VGA<select></select>").result.status).toBe("no-stamp")
  })

  test("記下後比對上一份快照的售價、新增、移除與狀態", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    const morningPage = page.replace(
      "<option>華碩 TUF-RTX5090(2520MHz), $99990</option>",
      "<option>華碩 TUF-RTX5090(2520MHz), $99990</option><option>微星 RTX5090 SUPRIM(2520MHz), $109990</option>",
    )
    const morning = ingestCoolpc(empty, morningPage)
    const evening = `
      2026/10/24 19:05<span style="font-family:'Segoe UI Symbol'">&#xe1db;</span>
      顯示卡VGA
      <select name="n12">
        <optgroup label="NVIDIA RTX5090">
          <option>華碩 TUF-RTX5090(2520MHz), $89990 售罄</option>
          <option>技嘉 RTX5090 GAMING(2520MHz), $79990</option>
        </optgroup>
      </select>
    `
    const saved = ingestCoolpc(morning.prepared, evening)
    expect(saved.result.status).toBe("saved")
    if (saved.result.status !== "saved") {
      return
    }
    expect(changesAgainstPrevious(morning.prepared, saved.prepared, saved.result.capturedAt)).toEqual({
      previousAt: "2026-10-24T18:05:00",
      lines: [
        "售價 華碩 TUF-RTX5090 $99,990 → $89,990 一般 → 售罄",
        "新增 技嘉 RTX5090 GAMING $79,990",
        "移除 微星 RTX5090 SUPRIM $109,990",
      ],
    })

    const unchanged = ingestCoolpc(saved.prepared, evening.replace("19:05", "20:05"))
    expect(unchanged.result.status).toBe("saved")
    if (unchanged.result.status !== "saved") {
      return
    }
    expect(changesAgainstPrevious(saved.prepared, unchanged.prepared, unchanged.result.capturedAt).lines).toEqual([])
    expect(changesAgainstPrevious(empty, morning.prepared, "2026-10-24T10:05:00.000Z").previousAt).toBeNull()
  })
})

const capturedAt = "2026-10-24T10:05:00.000Z"

const memoryPage = `
  記憶體 RAM
  <select name="n6">
    <option>共有商品 2 樣，熱賣 1</option>
    <optgroup label="桌上型記憶體 DDR4">
      <option>｛UMAX 16GB DDR4-2666｝(1024*8)CL19, $3750</option>
      <option>｛UMAX 16GB DDR4-2666｝(2048*8)(CL19, $3950</option>
      <option>｛UMAX NB 16GB DDR5 5600｝/CL46, $7500 ◆ ★ 熱賣</option>
      <option>｛UMAX NB 16GB DDR5 5600｝/CL46~搭機價~, $7150 ◆ ★ 熱賣</option>
    </optgroup>
    <optgroup label="伺服器專用記憶體 DDR5 RDIMM">
      <option>芝奇G5 64G(64G*1) D5-5600 C46 ECC REG(F5-5600R4645A64GX1-G5), $92200</option>
      <option>芝奇G5 64G(64G*1) D5-6400 C52 ECC REG(F5-6400R5252A64GX1-G5), $98000</option>
    </optgroup>
  </select>
`

describe("記憶體報價列", () => {
  test("括號外的差別各自留著，裝機價併進一般價，統計列不算", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    const saved = ingestMemory(empty, memoryPage, capturedAt)
    expect(saved.status).toBe("saved")
    if (saved.status !== "saved") {
      return
    }
    expect(saved.prepared.quotes.map((quote) => [quote.code, quote.sellingPrice])).toEqual([
      ["UMAX 16GB DDR4-2666 (1024*8)CL19", 3750],
      ["UMAX 16GB DDR4-2666 (2048*8)(CL19", 3950],
      ["UMAX NB 16GB DDR5 5600 /CL46", 7500],
      ["芝奇G5 64G(64G*1) D5-5600 C46 ECC REG(F5-5600R4645A64GX1-G5)", 92200],
      ["芝奇G5 64G(64G*1) D5-6400 C52 ECC REG(F5-6400R5252A64GX1-G5)", 98000],
    ])
    expect(ingestMemory(saved.prepared, memoryPage, capturedAt).status).toBe("already")
    expect(ingestMemory(empty, "顯示卡VGA", capturedAt)).toEqual({ status: "no-menu", prepared: empty })
  })

  test("同一代號沒有一般價時，兩個售價取較低者", () => {
    const html = `
      記憶體 RAM
      <select>
        <option>｛Biwin DDR5-6000｝CL28 黑, $21890</option>
        <option>｛Biwin DDR5-6000｝CL28 黑, $21800</option>
      </select>
    `
    const saved = ingestMemory({ quotes: [], done: [] }, html, capturedAt)
    expect(saved.status).toBe("saved")
    if (saved.status !== "saved") {
      return
    }
    expect(saved.prepared.quotes.map((quote) => quote.sellingPrice)).toEqual([21800])
  })

  test("記下後比對上一份記憶體快照", () => {
    const empty: PreparedSeries = { quotes: [], done: [] }
    const morning = ingestMemory(empty, memoryPage, capturedAt)
    const eveningHtml = memoryPage
      .replace("(1024*8)CL19, $3750", "(1024*8)CL19, $3600")
      .replace("芝奇G5 64G(64G*1) D5-6400 C52 ECC REG(F5-6400R5252A64GX1-G5), $98000", "｛金士頓 單條16GB DDR5-5600｝/CL46, $8500")
    const eveningAt = "2026-10-24T11:05:00.000Z"
    const evening = ingestMemory(morning.prepared, eveningHtml, eveningAt)
    expect(evening.status).toBe("saved")
    if (morning.status !== "saved" || evening.status !== "saved") {
      return
    }
    expect(changesAgainstPrevious(morning.prepared, evening.prepared, eveningAt)).toEqual({
      previousAt: capturedAt,
      lines: [
        "售價 UMAX 16GB DDR4-2666 (1024*8)CL19 $3,750 → $3,600",
        "新增 金士頓 單條16GB DDR5-5600 /CL46 $8,500",
        "移除 芝奇G5 64G(64G*1) D5-6400 C52 ECC REG(F5-6400R5252A64GX1-G5) $98,000",
      ],
    })
    expect(changesAgainstPrevious(empty, morning.prepared, capturedAt).previousAt).toBeNull()
  })
})
