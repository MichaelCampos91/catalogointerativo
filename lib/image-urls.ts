export const PLACEHOLDER_IMAGE_URL = "/files/Z/placeholder.svg"

/**
 * Resolve as URLs de imagens a partir de seus códigos consultando o endpoint
 * público de catálogo. Mantém compatibilidade com o fallback histórico
 * (`/api/images?code=...`) caso o endpoint público falhe.
 *
 * Retorna um mapa code → url, com `PLACEHOLDER_IMAGE_URL` quando não encontrado.
 */
export async function resolveImageUrls(codes: string[]): Promise<Record<string, string>> {
  if (!codes || codes.length === 0) return {}

  const unique = Array.from(new Set(codes))
  const resolved: Record<string, string> = {}

  try {
    const res = await fetch(`/api/public-catalog?all=true&limit=9999&page=1`)
    if (res.ok) {
      const j = await res.json()
      if (Array.isArray(j.images)) {
        for (const img of j.images) {
          if (img && img.code && img.url) resolved[img.code] = img.url
        }
      }
      if (Array.isArray(j.categories)) {
        for (const cat of j.categories) {
          if (cat && Array.isArray(cat.images)) {
            for (const img of cat.images) {
              if (img && img.code && img.url) resolved[img.code] = img.url
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[image-urls] Falha ao consultar /api/public-catalog:", error)
  }

  const missing = unique.filter((code) => !resolved[code])
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (code) => {
        try {
          const r = await fetch(`/api/images?code=${encodeURIComponent(code)}`)
          if (r.ok) {
            const d = await r.json()
            if (d && typeof d.url === "string") {
              resolved[code] = d.url
            }
          }
        } catch {
          // mantém ausente; será tratado como placeholder abaixo
        }
      }),
    )
  }

  for (const code of unique) {
    if (!resolved[code]) {
      resolved[code] = PLACEHOLDER_IMAGE_URL
    }
  }
  return resolved
}
