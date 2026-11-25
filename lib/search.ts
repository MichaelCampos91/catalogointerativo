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

/** Termo normalizado de uma busca concluída. Null se tiver menos de 3 letras ou números. */
export function completedSearchTerm(raw: string): string | null {
  const normalized = normalizeForSearch(raw)
  const alphanumeric = normalized.replace(/[^\p{L}\p{N}]/gu, "")
  if (alphanumeric.length < 3) return null
  return normalized
}
