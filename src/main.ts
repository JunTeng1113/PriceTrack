import { start } from "./browse.ts"
import { emptySeries, update, type PriceSeries, type Snapshot } from "./present.ts"

const snapshot: Snapshot = {
  capturedAt: "2024-06-15T02:00:00.000Z",
  html: `
    <tr>
      <td>顯示卡VGA</td>
      <td>
        <select name="n12">
          <option>共有商品 1 樣</option>
          <optgroup label="NVIDIA RTX4070">
            <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz/24cm/雙風扇, $18990</option>
          </optgroup>
        </select>
      </td>
    </tr>
  `,
}

export function demoSeries(): PriceSeries {
  return update(emptySeries(), [snapshot])
}

if (import.meta.env.MODE === "test") {
  start(demoSeries())
}
