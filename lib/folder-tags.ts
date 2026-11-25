import { matchesSearch, normalizeForSearch } from "@/lib/search"

export const MAX_TAGS_PER_FOLDER = 30
export const MAX_TAG_LENGTH = 80
export const MAX_TAG_WORDS = 3

export type TagParseResult = {
  tags: string[]
  error: string | null
}

export function cleanTagText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function parseTagList(rawTags: string[]): TagParseResult {
  const tags: string[] = []
  const seen = new Set<string>()

  for (const raw of rawTags) {
    const tag = cleanTagText(raw)
    if (!tag) continue
    if (tag.length > MAX_TAG_LENGTH) {
      return { tags: [], error: `Cada tag pode ter no máximo ${MAX_TAG_LENGTH} caracteres` }
    }
    const words = tag.split(" ")
    if (words.length > MAX_TAG_WORDS) {
      return { tags: [], error: "Cada tag pode ter no máximo 3 palavras" }
    }
    const key = normalizeForSearch(tag)
    if (!key) {
      return { tags: [], error: "Tag inválida" }
    }
    if (seen.has(key)) {
      return { tags: [], error: `A tag "${tag}" está repetida` }
    }
    seen.add(key)
    tags.push(tag)
  }

  if (tags.length > MAX_TAGS_PER_FOLDER) {
    return { tags: [], error: `No máximo ${MAX_TAGS_PER_FOLDER} tags por pasta` }
  }

  return { tags, error: null }
}

export function splitTagInput(value: string): { committed: string[]; remainder: string } {
  if (!value.includes(",")) {
    return { committed: [], remainder: value }
  }
  const parts = value.split(",")
  const remainder = parts.pop() ?? ""
  const committed = parts.map((part) => cleanTagText(part)).filter(Boolean)
  return { committed, remainder }
}

export function buildFolderPath(dir: string, folderName: string): string | null {
  const cleanDir = (dir.startsWith("files/") ? dir.slice(6) : dir).replace(/^\/+|\/+$/g, "")
  const name = folderName.replace(/\.\./g, "").replace(/^\/+|\/+$/g, "").trim()
  if (!name || name.includes("/") || name.includes("..")) return null
  if (cleanDir.includes("..")) return null
  const dirParts = cleanDir.split("/").filter(Boolean)
  if (dirParts.some((part) => part === "." || part === "..")) return null
  return [...dirParts, name].join("/")
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[#\\%_]/g, (char) => `#${char}`)
}

export function folderPathLikePrefix(folderPath: string): string {
  return `${escapeLikePattern(folderPath)}/%`
}

export function tagsForPath(
  tagsByPath: Map<string, string[]>,
  folderPath: string
): { own: string[]; related: string[] } {
  const own = tagsByPath.get(folderPath) ?? []
  const prefix = `${folderPath}/`
  const related = [...own]
  for (const [path, tags] of tagsByPath) {
    if (path.startsWith(prefix)) related.push(...tags)
  }
  return { own, related }
}

type SearchableImage = { name: string; code: string }

export function categoryMatchesQuery<T extends SearchableImage>(
  category: { name: string; images?: T[] },
  query: string,
  tags: string[]
): { include: boolean; images: T[] } {
  const images = category.images ?? []
  if (!normalizeForSearch(query)) {
    return { include: true, images }
  }

  const matchedByNameOrTag =
    matchesSearch(category.name, query) || tags.some((tag) => matchesSearch(tag, query))
  if (matchedByNameOrTag) {
    return { include: true, images }
  }

  const matchingImages = images.filter(
    (image) => matchesSearch(image.code, query) || matchesSearch(image.name, query)
  )
  return { include: matchingImages.length > 0, images: matchingImages }
}

export function replaceOwnSearchTags(own: string[], matchTags: string[], nextOwn: string[]): string[] {
  const ownKeys = new Set(own.map((tag) => normalizeForSearch(tag)))
  const descendants = matchTags.filter((tag) => !ownKeys.has(normalizeForSearch(tag)))
  return [...nextOwn, ...descendants]
}
