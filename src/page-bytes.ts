export function decodePage(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2000)).toLowerCase()
  const hinted = `${contentType.toLowerCase()} ${head}`
  const charset = hinted.includes("big5") || hinted.includes("ms950") || hinted.includes("cp950") ? "big5" : "utf-8"
  return new TextDecoder(charset).decode(bytes)
}
