import { present, type Action, type PriceSeries } from "./present.ts"

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replaceAll('"', "&quot;")
}

function keywordText(actions: readonly Action[]): string {
  let keyword = ""
  for (const action of actions) {
    if (action.type === "setKeyword") {
      keyword = action.text
    }
  }
  return keyword
}

export function renderPage(series: PriceSeries, actions: readonly Action[]): string {
  const view = present(series, actions)
  const keyword = escapeAttribute(keywordText(actions))
  const candidates = view.candidates
    .map((code) => `<li><button type="button">${escapeHtml(code)}</button></li>`)
    .join("")
  const selected = view.selected.map((code) => `<li>${escapeHtml(code)}</li>`).join("")
  const points = view.series.flatMap((item) =>
    item.quotes.map((quote) => `<li>${escapeHtml(quote.date)} ${escapeHtml(item.code)} ${quote.sellingPrice}</li>`),
  ).join("")
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <body>
    <section>
      <h2>篩選</h2>
      <label>關鍵字 <input aria-label="關鍵字" value="${keyword}"></label>
      <ul aria-label="候選">${candidates}</ul>
      <p>已選</p>
      <ul aria-label="已選">${selected}</ul>
    </section>
    <section>
      <h2>價格序列</h2>
      <ul>${points}</ul>
    </section>
  </body>
</html>`
}
