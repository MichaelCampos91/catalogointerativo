import { NextResponse } from "next/server"
import { getTrendingImageCodes } from "@/lib/database"
import { resolveTrendingCatalogImages } from "@/app/api/files/route"
import { getFromCache, setCache } from "@/lib/r2-cache"

const CACHE_KEY = "catalog:trends:v1"

function parseEnvInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * GET público: top códigos dos últimos N dias resolvidos para URLs do R2.
 * Falha isolada: retorna images: [].
 */
export async function GET() {
  try {
    const cached = getFromCache(CACHE_KEY)
    if (cached && Array.isArray(cached.images)) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "X-Cache": "HIT",
        },
      })
    }

    const limit = parseEnvInt("TRENDS_LIMIT", 30)
    const days = parseEnvInt("TRENDS_DAYS", 7)

    const codes = await getTrendingImageCodes(limit, days)
    const images = await resolveTrendingCatalogImages(codes)

    const payload = { images }
    setCache(CACHE_KEY, payload)

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Cache": "MISS",
      },
    })
  } catch (e) {
    console.error("[catalog/trends]", e)
    return NextResponse.json(
      { images: [] },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60" },
      }
    )
  }
}
