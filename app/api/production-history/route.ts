import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getProductionBatches } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

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
    const periodFrom = searchParams.get("periodFrom") ?? undefined
    const periodTo = searchParams.get("periodTo") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

    const result = await getProductionBatches({
      periodFrom,
      periodTo,
      page,
      pageSize,
    })
    return NextResponse.json({
      batches: result.batches,
      total: result.total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("API: Erro ao buscar histórico de produção:", error)
    return NextResponse.json(
      {
        error: "Erro ao buscar histórico de produção",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
