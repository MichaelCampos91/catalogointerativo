import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  ensureSearchSchema,
  getCatalogSearchStats,
  resolveDashboardPeriod,
  type DashboardPreset,
  type SearchStatsSort,
} from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

const PRESETS = ["this_month", "last_month", "last_3_months", "custom", "all"] as const
const SORTS: SearchStatsSort[] = ["count_desc", "count_asc", "alpha_asc", "alpha_desc"]
const PAGE_SIZE = 50

type SearchStatsPreset = (typeof PRESETS)[number]

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const preset = (searchParams.get("preset") || "this_month") as SearchStatsPreset
    const sort = (searchParams.get("sort") || "count_desc") as SearchStatsSort
    const page = Number.parseInt(searchParams.get("page") || "1", 10)

    if (!PRESETS.includes(preset)) {
      return NextResponse.json({ error: "Período inválido" }, { status: 400 })
    }
    if (!SORTS.includes(sort)) {
      return NextResponse.json({ error: "Ordenação inválida" }, { status: 400 })
    }
    if (!Number.isFinite(page) || page < 1) {
      return NextResponse.json({ error: "Página inválida" }, { status: 400 })
    }

    let from: Date | null = null
    let toExclusive: Date | null = null
    if (preset !== "all") {
      try {
        const range = resolveDashboardPeriod(
          preset as DashboardPreset,
          searchParams.get("from") || undefined,
          searchParams.get("to") || undefined
        )
        from = range.from
        toExclusive = range.toExclusive
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Período inválido" },
          { status: 400 }
        )
      }
    }

    await ensureSearchSchema()
    const stats = await getCatalogSearchStats({
      from,
      toExclusive,
      sort,
      page,
      limit: PAGE_SIZE,
    })
    const totalPages = Math.max(1, Math.ceil(stats.total / PAGE_SIZE))

    return NextResponse.json(
      {
        preset,
        sort,
        from: from ? from.toISOString() : null,
        to: toExclusive ? toExclusive.toISOString() : null,
        page,
        limit: PAGE_SIZE,
        total: stats.total,
        totalPages,
        rows: stats.rows,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("API: Erro ao carregar termos pesquisados:", error)
    return NextResponse.json(
      {
        error: "Erro ao carregar termos pesquisados",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
