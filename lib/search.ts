export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
}

export function matchesSearch(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query)
  if (!normalizedQuery) return true
  const normalizedHaystack = normalizeForSearch(haystack)
  return normalizedQuery.split(" ").every((token) => normalizedHaystack.includes(token))
}
