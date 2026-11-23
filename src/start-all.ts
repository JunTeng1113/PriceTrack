import { config as loadEnv } from "dotenv"
import { spawn, type ChildProcess } from "node:child_process"

loadEnv()

const children: ChildProcess[] = []

function run(name: string, script: string): void {
  const child = spawn(
    process.execPath,
    ["./node_modules/vite-node/vite-node.mjs", script],
    {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    },
  )
  children.push(child)
  child.on("exit", (code, signal) => {
    console.error(`[${name}] 結束 code=${code ?? "null"} signal=${signal ?? "null"}`)
    for (const other of children) {
      if (other !== child && other.exitCode === null) {
        other.kill("SIGTERM")
      }
    }
    process.exit(code ?? 1)
  })
}

run("web", "src/api-server.ts")
run("coolpc", "src/watch-coolpc.ts")

console.log("Railway：網頁+API 與 coolpc 同時執行中")

process.on("SIGINT", () => {
  for (const child of children) {
    child.kill("SIGINT")
  }
})

process.on("SIGTERM", () => {
  for (const child of children) {
    child.kill("SIGTERM")
  }
})
