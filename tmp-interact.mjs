import { spawn } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const profile = mkdtempSync(join(tmpdir(), "pricetrack-chrome-"))
const port = 9333
const browser = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1280,900",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "http://127.0.0.1:5173/",
], { stdio: "ignore" })

function send(ws, id, method, params) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 90000)
    const onMessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data)
      const message = JSON.parse(raw)
      if (message.id !== id) {
        return
      }
      clearTimeout(timer)
      ws.removeEventListener("message", onMessage)
      if (message.error !== undefined) {
        reject(new Error(JSON.stringify(message.error)))
        return
      }
      resolve(message.result)
    }
    ws.addEventListener("message", onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

let page = null
for (let attempt = 0; attempt < 20 && page === null; attempt += 1) {
  await sleep(500)
  const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null)
  if (response === null || !response.ok) {
    continue
  }
  const targets = await response.json()
  page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl !== undefined) ?? null
}
if (page === null) {
  browser.kill()
  throw new Error("Chrome 沒有開出頁面")
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true })
  ws.addEventListener("error", reject, { once: true })
})
await send(ws, 1, "Runtime.enable", {})

async function evaluate(id, expression) {
  const evaluated = await send(ws, id, "Runtime.evaluate", { expression, returnByValue: true })
  return evaluated.result?.value ?? null
}

const ready = `document.querySelectorAll("section[aria-label]").length > 2`
let open = false
for (let attempt = 0; attempt < 30 && !open; attempt += 1) {
  open = await evaluate(10 + attempt, ready) === true
  if (!open) {
    await sleep(1000)
  }
}

const hover = await evaluate(50, `(() => {
  const svg = document.querySelector("section[aria-label] svg")
  if (svg === null) return { ok: false }
  svg.scrollIntoView()
  const before = window.scrollY
  const marker = document.createElement("p")
  marker.id = "keep"
  document.body.append(marker)
  const line = svg.querySelector("line[data-code]")
  if (line === null) return { ok: false, reason: "no line" }
  const box = svg.getBoundingClientRect()
  line.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + 20 }))
  const readout = svg.closest("section")?.querySelector('[aria-label="讀數"]')?.textContent ?? ""
  return {
    ok: true,
    charts: document.querySelectorAll("section[aria-label]").length,
    readout,
    kept: document.getElementById("keep") !== null,
    scroll: window.scrollY === before,
  }
})()`)

const picked = await evaluate(60, `(() => {
  document.querySelector('[aria-label="晶片分組"]')?.click()
  const item = [...document.querySelectorAll('[data-slot="select-item"]')].find((node) => (node.textContent ?? "").includes("RTX5060Ti-8GB"))
  const name = item?.textContent ?? ""
  item?.click()
  return { name, charts: document.querySelectorAll("section[aria-label]").length }
})()`)

const legend = await evaluate(70, `(() => {
  const section = document.querySelector("section[aria-label]")
  const button = section?.querySelector('[aria-label="圖例"] button')
  const name = button?.textContent ?? ""
  button?.click()
  const codes = [...document.querySelectorAll("section[aria-label] svg [data-code]")]
    .map((node) => node.getAttribute("data-code"))
  return {
    name,
    pressed: document.querySelector("section[aria-label] [aria-label='圖例'] button[aria-pressed='true']")?.textContent ?? "",
    codes: [...new Set(codes)],
  }
})()`)

console.log(JSON.stringify({ open, hover, picked, legend }, null, 2))
ws.close()
browser.kill()
