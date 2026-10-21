import { describe, expect, test } from "vitest"
import { emptySeries, present, update, type Snapshot } from "../src/present.ts"

const capturedAt = "2024-06-15T02:00:00.000Z"

function vgaSnapshot(options: string): Snapshot {
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">
            <option>共有商品 2 樣</option>
            ${options}
          </select>
        </td>
      </tr>
    `,
  }
}

describe("代號與排除", () => {
  test("不是型號的分組名稱會拿掉宣傳字，轉接盒不列入", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5070-12GB(GDDR7) 3/5-10點開賣">
          <option>技嘉 RTX5070 GAMING(2520MHz), $24990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX5070-12GB(GDDR7)">
          <option>華碩 PRIME-RTX5070-12G(2520MHz), $25990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX5090-32GB(GDDR7) 年節期間現貨+預定皆已完售！">
          <option>微星 RTX5090 32G VENTUS(2520MHz), $99990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3080 零星到貨! 隨時開放">
          <option>華碩 TUF-RTX3080-O10G-GAMING(1800MHz), $29990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3070 解禁10/29 21:00">
          <option>華碩 DUAL-RTX3070-O8G(1800MHz), $19990</option>
        </optgroup>
        <optgroup label="AMD RX6800 首批公版卡">
          <option>華碩 Radeon RX6800-16G(1800MHz), $19990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4080-16G [11/16 10PM 開賣]">
          <option>華碩 TUF-RTX4080-16G-GAMING(2500MHz), $39990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070 SUPER 12GB(1/17晚上10點開賣)">
          <option>華碩 DUAL-RTX4070S-12G(2500MHz), $22990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX5070Ti-16GB(GDDR7)-2/20晚上10點開賣">
          <option>華碩 PRIME-RTX5070TI-16G(2500MHz), $28990</option>
        </optgroup>
        <optgroup label="INTEL Arc B580 顯示卡">
          <option>華擎 ARC B580 Challenger 12G OC(2800MHz), $8990</option>
        </optgroup>
        <optgroup label="NVIDIA GTX1660Ti (無類比輸出)">
          <option>技嘉 GTX1660Ti OC 6G(1770MHz), $6990</option>
        </optgroup>
        <optgroup label="AMD Radeon 550 系列">
          <option>華碩 Radeon 550(1000MHz), $1990</option>
        </optgroup>
        <optgroup label="NVIDIA Quadro 專業繪圖卡 (歡迎議價)">
          <option>NVIDIA Quadro P620(1000MHz), $4990</option>
        </optgroup>
        <optgroup label="NVIDIA Quadro 專業繪圖卡">
          <option>NVIDIA Quadro P600(1000MHz), $3990</option>
        </optgroup>
        <optgroup label="微星 RX6600XT MECH 2X 8G V1(2589MHz/21.5cm/註四年)*參考價$13490">
          <option>微星 RX6600XT MECH 2X 8G OCV1(2589MHz), $9990</option>
        </optgroup>
        <optgroup label="AMD 專業級/工作站級 顯卡">
          <option>華碩 TURBO AI PRO R9700(2000MHz), $39990</option>
        </optgroup>
        <optgroup label="NVIDIA / AMD 外接顯卡轉接盒 (需另購顯卡)">
          <option>Razer Core X(0MHz), $9990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070-12GB (GDDR6)">
          <option>華碩 DUAL-RTX4070-O12G(2535MHz), $18990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070-12GB (GDDR6X)">
          <option>技嘉 RTX4070 GAMING OC 12G(2520MHz), $19990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [])

    expect(view.chipGroups).toEqual([
      "NVIDIA RTX5070-12GB(GDDR7)",
      "NVIDIA RTX5090-32GB(GDDR7)",
      "NVIDIA RTX3080",
      "NVIDIA RTX3070",
      "AMD RX6800",
      "NVIDIA RTX4080-16GB",
      "NVIDIA RTX4070 SUPER 12GB",
      "NVIDIA RTX5070Ti-16GB(GDDR7)",
      "INTEL Arc B580",
      "NVIDIA GTX1660Ti",
      "AMD Radeon 550",
      "NVIDIA Quadro 專業繪圖卡",
      "AMD RX6600XT",
      "AMD Radeon AI PRO R9700",
      "NVIDIA RTX4070-12GB (GDDR6)",
      "NVIDIA RTX4070-12GB (GDDR6X)",
    ])
  })

  test("RTX5090 標題寫成 16GB 時仍是 32GB 那一組", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5090-32GB(GDDR7)">
          <option>華碩 ROG-ASTRAL-RTX5090-O32G-GAMING(2520MHz), $99990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX5090-16GB(GDDR7) 年節期間現貨+預定皆已完售！">
          <option>微星 RTX5090 32G VENTUS 3X OC(2452MHz), $71990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [])
    const chart = view.modelCharts.find((item) => item.group === "NVIDIA RTX5090-32GB(GDDR7)")

    expect(view.chipGroups).toEqual(["NVIDIA RTX5090-32GB(GDDR7)"])
    expect(chart?.series.map((line) => line.code)).toEqual([
      "華碩 ROG-ASTRAL-RTX5090-O32G-GAMING",
      "微星 RTX5090 32G VENTUS 3X OC",
    ])
  })

  test("容量的 G 與 GB、括號容量與連字號容量是同一分組", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX3060-8G">
          <option>華碩 DUAL-RTX3060-O8G(1807MHz), $9990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3060-8GB">
          <option>技嘉 RTX3060 GAMING OC 8G(1807MHz), $10990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3060-12GB">
          <option>華碩 TUF-RTX3060-O12G(1807MHz), $12990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX2060(12G)">
          <option>華碩 DUAL-RTX2060-O12G(1680MHz), $8990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX2060-12G">
          <option>技嘉 RTX2060 WINDFORCE 12G(1680MHz), $7990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3080(10G)">
          <option>華碩 TUF-RTX3080-O10G(1800MHz), $19990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3080-10G">
          <option>技嘉 RTX3080 GAMING 10G(1800MHz), $18990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070TI-12G">
          <option>華碩 TUF-RTX4070TI-O12G(2500MHz), $24990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070Ti 12GB">
          <option>技嘉 RTX4070 Ti GAMING 12G(2500MHz), $23990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3060TI-8G(GDDR6)">
          <option>華碩 DUAL-RTX3060TI-O8G(1695MHz), $11990</option>
        </optgroup>
        <optgroup label="NVIDIA RTX3060TI-8G(GDDR6X)">
          <option>華碩 TUF-RTX3060TI-O8G-GAMING(1695MHz), $13990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [])

    expect(view.chipGroups).toEqual([
      "NVIDIA RTX3060-8GB",
      "NVIDIA RTX3060-12GB",
      "NVIDIA RTX2060-12GB",
      "NVIDIA RTX3080-10GB",
      "NVIDIA RTX4070Ti-12GB",
      "NVIDIA RTX3060Ti-8GB(GDDR6)",
      "NVIDIA RTX3060Ti-8GB(GDDR6X)",
    ])
  })

  test("晶片分組名稱含周邊的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA / AMD 顯示卡周邊配件">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("晶片分組名稱含配件的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="顯示卡配件">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("晶片分組名稱含支架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="顯卡支架">
          <option>｛酷碼 VGA Holder｝千斤頂, $490</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "Holder" }])

    expect(view.candidates).toEqual([])
  })

  test("代號含支架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 顯卡支架｝氣泡水平儀, $1290</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "顯卡支架" }])

    expect(view.candidates).toEqual([])
  })

  test("代號含支撐架的列不出現在候選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 顯卡支撐架｝氣泡水平儀, $1290</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "支撐架" }])

    expect(view.candidates).toEqual([])
  })

  test("只有開頭｛的代號取到第一個半形括號之前", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5060Ti">
          <option>｛技嘉 RTX5060Ti WINDFORCE OC 16G(2587MHz/28cm/三風扇), $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "windforce" }])

    expect(view.candidates).toEqual(["技嘉 RTX5060Ti WINDFORCE OC 16G"])
  })

  test("代號兩端空白不構成另一個報價列", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛ 華碩 DUAL-RTX4070-O12G ｝2535MHz, $20990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "DUAL-RTX4070" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("只有括號外文字不同的列在候選清單裡是同一個代號", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝三年保固, $20990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝限搭機, $18990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "DUAL-RTX4070" }])

    expect(view.candidates).toEqual(["華碩 DUAL-RTX4070-O12G"])
  })

  test("代號不同的列可以分別加入已選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
          <option>｛華碩 DUAL-RTX4070-O12G-WHITE｝2535MHz, $19990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [
      { type: "select", code: "華碩 DUAL-RTX4070-O12G" },
      { type: "select", code: "華碩 DUAL-RTX4070-O12G-WHITE" },
    ])

    expect(view.selected).toEqual([
      "華碩 DUAL-RTX4070-O12G",
      "華碩 DUAL-RTX4070-O12G-WHITE",
    ])
  })

  test("沒有｛但有半形括號的列，代號是括號前的文字", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA GTX1650 (DDR6)">
          <option>華碩 DUAL-GTX1650-O4GD6-P-EVO(1785MHz/21.2cm/雙風扇)時脈高, $4490</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "DUAL" }])

    expect(view.candidates).toEqual(["華碩 DUAL-GTX1650-O4GD6-P-EVO"])
  })

  test("沒有｛的列和沒有金額的統計列不出現在候選清單", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>共有商品 12 樣，最低 $9900</option>
          <option>♥ 熱賣 顯示卡下殺 $18990</option>
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
        </optgroup>
      `),
    ])
    const ads = present(series, [{ type: "setKeyword", text: "熱賣" }])
    const summary = present(series, [{ type: "setKeyword", text: "共有商品" }])

    expect(ads.candidates).toEqual([])
    expect(summary.candidates).toEqual([])
  })

  test("工作站繪圖卡與外接式顯示卡可以找到並加入已選", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA 工作站繪圖卡">
          <option>｛麗臺 RTX A5000｝24G, $42990</option>
        </optgroup>
        <optgroup label="外接式顯示卡">
          <option>｛技嘉 AORUS RTX3080 Gaming Box｝外接盒, $32990</option>
        </optgroup>
      `),
    ])
    const workstation = present(series, [{ type: "setKeyword", text: "A5000" }])
    const external = present(series, [{ type: "setKeyword", text: "gaming box" }])
    const selected = present(series, [
      { type: "select", code: "麗臺 RTX A5000" },
      { type: "select", code: "技嘉 AORUS RTX3080 Gaming Box" },
    ])

    expect(workstation.candidates).toEqual(["麗臺 RTX A5000"])
    expect(external.candidates).toEqual(["技嘉 AORUS RTX3080 Gaming Box"])
    expect(selected.selected).toEqual([
      "麗臺 RTX A5000",
      "技嘉 AORUS RTX3080 Gaming Box",
    ])
  })

  test("搭機優惠、限期優惠、搭機價、不漲限搭機不是代號的一部分", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5060">
          <option>[不漲！限搭機] 華碩 DUAL-RTX5060-O8G(2497MHz), $9990</option>
          <option>[搭機優惠] 微星 RTX5060 8G VENTUS 2X(2497MHz), $8990</option>
          <option>[限期優惠] 技嘉 RTX5060 WINDFORCE 8G(2497MHz), $8890</option>
          <option>[搭機價] ZOTAC RTX5060 Twin Edge(2497MHz), $8790</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setKeyword", text: "RTX5060" }])

    expect(view.candidates).toEqual([
      "ZOTAC RTX5060 Twin Edge",
      "微星 RTX5060 8G VENTUS 2X",
      "技嘉 RTX5060 WINDFORCE 8G",
      "華碩 DUAL-RTX5060-O8G",
    ])
  })

  test("銷售優惠前綴不把同一代號拆成兩條", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5060">
          <option>[不漲！限搭機] 華碩 DUAL-RTX5060-O8G(2497MHz), $9990</option>
          <option>華碩 DUAL-RTX5060-O8G(2497MHz), $10990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "select", code: "華碩 DUAL-RTX5060-O8G" }])

    expect(view.series).toEqual([
      {
        code: "華碩 DUAL-RTX5060-O8G",
        quotes: [{ date: "2024-06-15", sellingPrice: 9990 }],
      },
    ])
  })

  test("品牌按鈕依華碩、技嘉、微星、INNO3D、ZOTAC，其餘合併為其他", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5090">
          <option>藍寶石 脈動 RX9070(2497MHz), $18990</option>
          <option>ZOTAC RTX5090 SOLID(2520MHz), $99990</option>
          <option>INNO3D RTX5090 X3(2520MHz), $98990</option>
          <option>微星 RTX5090 32G(2520MHz), $97990</option>
          <option>技嘉 RTX5090 GAMING(2520MHz), $96990</option>
          <option>華碩 TUF-RTX5090(2520MHz), $95990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [])

    expect(view.modelCharts[0]?.brands).toEqual(["華碩", "技嘉", "微星", "INNO3D", "ZOTAC", "其他"])
  })

  test("方括號裡的銷售宣傳不是代號，品牌取後面的廠牌", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5090">
          <option>[限組裝] 華碩 TUF-RTX5090-O32G-GAMING(2520MHz), $99990</option>
          <option>[限搭機] 技嘉 RTX5090 GAMING OC 32G(2520MHz), $98990</option>
          <option>[合購省] 技嘉 GTX1660Ti OC 6G + 技嘉 GP-P650B(1770MHz), $6990</option>
          <option>[2/24]Acer Nitro ARC B580 OC 12GB(2800MHz), $8990</option>
          <option>[限任搭] ACER NITRO RX9070XT 16G OC(2497MHz), $18990</option>
          <option>[加購省!] 買華擎 RX9060XT Challenger+加購 SL-750G(2497MHz), $7990</option>
          <option>[帝版-5090散熱] ZOTAC RTX5070Ti AMP Extreme INFINITY(2617MHz), $28990</option>
          <option>[無痛升級帝版AMP] ZOTAC RTX5080 SOLID CORE(2617MHz), $30990</option>
          <option>[無痛升OC] ZOTAC RTX5070Ti SOLID CORE(2497MHz), $24990</option>
          <option>[不零售]微星 RTX5070Ti 16G INSPIRE 3X OC(2497MHz), $28990</option>
          <option>[缺貨無痛升5060TI 8GB月白三風扇-僅限量30片] ZOTAC RTX5060 AMP(2497MHz), $9990</option>
          <option>[開學祭]ZOTAC RTX3060 TWIN EDGE 12G(1807MHz), $6990</option>
          <option>[活動]ZOTAC RTX3060 TWIN EDGE 12G(1807MHz), $6890</option>
          <option>[裝機價]華擎 RX9070XT Taichi White 16GB OC(2497MHz), $19990</option>
          <option>[雙11任搭]藍寶石 脈動 PULSE RX9060XT GAMING OC 8GB(2497MHz), $8990</option>
          <option>[任搭]藍寶石 脈動 PULSE RX9060XT GAMING OC 8GB(2497MHz), $9090</option>
        </optgroup>
      `),
    ])
    const view = present(series, [])
    const chart = view.modelCharts[0]

    expect(chart?.brands).toEqual(["華碩", "技嘉", "微星", "ZOTAC", "其他"])
    expect(chart?.series.map((line) => line.code)).toEqual([
      "華碩 TUF-RTX5090-O32G-GAMING",
      "技嘉 RTX5090 GAMING OC 32G",
      "Acer Nitro ARC B580 OC 12GB",
      "ACER NITRO RX9070XT 16G OC",
      "ZOTAC RTX5070Ti AMP Extreme INFINITY",
      "ZOTAC RTX5080 SOLID CORE",
      "ZOTAC RTX5070Ti SOLID CORE",
      "微星 RTX5070Ti 16G INSPIRE 3X OC",
      "ZOTAC RTX5060 AMP",
      "ZOTAC RTX3060 TWIN EDGE 12G",
      "華擎 RX9070XT Taichi White 16GB OC",
      "藍寶石 脈動 PULSE RX9060XT GAMING OC 8GB",
    ])
    expect(chart?.series.find((line) => line.code === "ZOTAC RTX3060 TWIN EDGE 12G")?.quotes).toEqual([
      { date: "2024-06-15", sellingPrice: 6890 },
    ])
    expect(chart?.series.find((line) => line.code === "藍寶石 脈動 PULSE RX9060XT GAMING OC 8GB")?.quotes).toEqual([
      { date: "2024-06-15", sellingPrice: 8990 },
    ])
  })

  test("組合價不呈現", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
          <option>[限組裝] 華碩 TUF-RTX4070-O12G-GAMING(2520MHz), $19990</option>
          <option>[合購價] 技嘉 RTX4070 GAMING OC 12G + 技嘉 GP-UD750GM(2520MHz), $20990</option>
          <option>[原廠指定組合]華碩TURBO-RTX4070-12G + TUF GAMING 650W銅(限組裝), $21990</option>
          <option>&#x2764; [活動]2/18前買 微星4070 Super 加價購 微星 A750GL PCIE5 只要 $2790(原價$3490)</option>
          <option>[紅包500] 買技嘉 RTX4070顯卡+購 GP-P650G(650W)金牌電源(原價2490), $1990</option>
          <option>[加購省!] 買華擎 RX9060XT Challenger+加購 SL-750G(2497MHz), $7990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setChipGroup", name: "NVIDIA RTX4070" }])

    expect(view.modelCharts[0]?.series.map((line) => line.code)).toEqual([
      "華碩 DUAL-RTX4070-O12G",
      "華碩 TUF-RTX4070-O12G-GAMING",
    ])
    expect(view.candidates).toEqual([
      "華碩 DUAL-RTX4070-O12G",
      "華碩 TUF-RTX4070-O12G-GAMING",
    ])
  })

  test("配件、買卡優惠不是顯示卡，卡加電源是組合價", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX4070">
          <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz, $18990</option>
          <option>INNO3D GTX1650 4GB Compact(1665MHz/三年保+365天換新), $4490</option>
          <option>藍寶石 氮動 NITRO+ RX9060XT GAMING OC 16GB(2497MHz), $9990</option>
          <option>華碩 ROG Strix Riser Cable PCIe X16 90度延長線/240mm/SafeSlot (限搭華碩顯卡), $990</option>
          <option>麗臺 mini-DP轉DVI-D轉接線(轉接), $390</option>
          <option>&#x2764; [鷹援團集合]9/30前購買技嘉系列產品.抽【洲際棒球場假日家庭席】兩張(價值$2,000元)</option>
          <option>&#x2764; [台灣ZOTAC奪冠!!] 買ZOTAC RTX3050 任搭主機板現折 NT.$500元 (9/10止)</option>
          <option>&#x2764; [台灣ZOTAC奪冠!!] 買ZOTAC RTX4070 SUPER 任搭主機板現折 NT.$1500元(9/10止)</option>
          <option>&#x2764; [超級618]買微星4070/4080 SUPER系列送VAMPIRIC 300R電競機殼(市價$2890)</option>
          <option>【振興方案】技嘉 GTX1650 D6 OC-4G + 技嘉 GP-P550B 銅牌 (現省800), $5480</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setChipGroup", name: "NVIDIA RTX4070" }])

    expect(view.modelCharts[0]?.series.map((line) => line.code)).toEqual([
      "華碩 DUAL-RTX4070-O12G",
      "INNO3D GTX1650 4GB Compact",
      "藍寶石 氮動 NITRO+ RX9060XT GAMING OC 16GB",
    ])
  })

  test("ROG-STRIX 沒有寫華碩時，品牌仍是華碩", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX5070Ti">
          <option>｛ROG-STRIX-RTX5070TI-16G-GAMING｝2482MHz, $49990</option>
          <option>｛華碩 ROG-STRIX-RTX5070TI-O16G-GAMING｝2580MHz, $52990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setBrand", group: "NVIDIA RTX5070Ti", name: "華碩" }])
    const chart = view.modelCharts[0]

    expect(chart?.brands).toEqual(["華碩"])
    expect(chart?.series.map((line) => line.code)).toEqual([
      "ROG-STRIX-RTX5070TI-16G-GAMING",
      "華碩 ROG-STRIX-RTX5070TI-O16G-GAMING",
    ])
  })

  test("愛心和列首的振興方案不是代號，型號裡的版本名仍在", () => {
    const card = "技嘉 RTX3060 GAMING OC 8G"
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX3060-8G">
          <option>&#x2764; ${card}(1807MHz), $10990</option>
          <option>【振興方案】${card}(1807MHz), $9990</option>
          <option>【猛】${card}(1807MHz), $9890</option>
          <option>&#x2764; [活動]${card}(1807MHz), $9790</option>
          <option>華碩 TUF-RTX3060-O12G-【V2】-GAMING(1807MHz), $11990</option>
          <option>ZOTAC RTX4060 8G OC SPIDER-MAN【蜘蛛人】(2497MHz), $8990</option>
        </optgroup>
      `),
    ])
    const view = present(series, [{ type: "setChipGroup", name: "NVIDIA RTX3060-8GB" }])
    const chart = view.modelCharts[0]

    expect(chart?.brands).toEqual(["華碩", "技嘉", "ZOTAC"])
    expect(chart?.series.map((line) => line.code)).toEqual([
      card,
      "華碩 TUF-RTX3060-O12G-【V2】-GAMING",
      "ZOTAC RTX4060 8G OC SPIDER-MAN【蜘蛛人】",
    ])
    expect(chart?.series.find((line) => line.code === card)?.quotes).toEqual([
      { date: "2024-06-15", sellingPrice: 9790 },
    ])
  })

  test("箭頭開頭的銷售優惠不是報價列", () => {
    const series = update(emptySeries(), [
      vgaSnapshot(`
        <optgroup label="NVIDIA RTX2080Ti">
          <option>&#x21AA; 買INNO3D iChill SUPER系列顯卡,送 群光 850W(五年保), $1990</option>
          <option>華碩 DUAL-RTX2080TI-O11G(1350MHz), $28990</option>
        </optgroup>
      `),
    ])
    const promo = present(series, [{ type: "setKeyword", text: "INNO3D" }])
    const card = present(series, [{ type: "setKeyword", text: "2080TI" }])

    expect(promo.candidates).toEqual([])
    expect(card.candidates).toEqual(["華碩 DUAL-RTX2080TI-O11G"])
  })
})
