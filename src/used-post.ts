export type UsedPost = {
  code: string
  date: string
  price: number
  link: string
}

export type UsedFields = {
  code: string
  date: string
  price: string
  link: string
}

export function usedPostFromFields(fields: UsedFields): UsedPost | null {
  const code = fields.code.trim()
  const date = fields.date.trim()
  const priceText = fields.price.trim()
  const link = fields.link.trim()
  if (code === "" || !isIsoDate(date) || !isLink(link) || !/^[1-9]\d*$/.test(priceText)) {
    return null
  }
  return { code, date, price: Number(priceText), link }
}

export function addUsedPost(posts: readonly UsedPost[], post: UsedPost): UsedPost[] | null {
  if (posts.some((item) => item.link === post.link)) {
    return null
  }
  return [...posts, post]
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) {
    return false
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isLink(value: string): boolean {
  const marker = "://"
  const scheme = value.startsWith("https://") ? "https" : value.startsWith("http://") ? "http" : ""
  if (scheme === "") {
    return false
  }
  const rest = value.slice(scheme.length + marker.length)
  return rest.includes(".") && !rest.includes(" ")
}
