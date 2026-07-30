import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  getDashboardData,
  resolveDashboardPeriod,
  type DashboardGranularity,
  type DashboardPreset,
} from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import { resolveTrendingCatalogImages } from "@/app/api/files/route"

const PRESETS: DashboardPreset[] = ["this_month", "last_month", "last_3_months", "custom"]
const GRANULARITIES: DashboardGranularity[] = ["day", "week", "month", "year"]

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
    const presetParam = (searchParams.get("preset") || "this_month") as DashboardPreset
    const granularityParam = (searchParams.get("granularity") || "day") as DashboardGranularity
    const fromParam = searchParams.get("from") || undefined
    const toParam = searchParams.get("to") || undefined

    if (!PRESETS.includes(presetParam)) {
      return NextResponse.json({ error: "Preset inválido" }, { status: 400 })
    }
    if (!GRANULARITIES.includes(granularityParam)) {
      return NextResponse.json({ error: "Granularidade inválida" }, { status: 400 })
    }

    let from: Date
    let toExclusive: Date
    try {
      ;({ from, toExclusive } = resolveDashboardPeriod(presetParam, fromParam, toParam))
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Período inválido" },
        { status: 400 }
      )
    }

    const data = await getDashboardData(from, toExclusive, granularityParam)
    const codes = data.topItems.map((i) => i.code)
    const images = await resolveTrendingCatalogImages(codes)
    const urlByCode = new Map(images.map((img) => [img.code, img.url]))

    return NextResponse.json({
      preset: presetParam,
      granularity: granularityParam,
      from: data.from,
      to: data.to,
      summary: data.summary,
      series: data.series,
      topQuantities: data.topQuantities,
      topItems: data.topItems.map((item) => ({
        ...item,
        image_url: urlByCode.get(item.code) || null,
      })),
      topCustomers: data.topCustomers,
    })
  } catch (error) {
    console.error("API: Erro ao carregar dashboard:", error)
    return NextResponse.json(
      {
        error: "Erro ao carregar dashboard",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
