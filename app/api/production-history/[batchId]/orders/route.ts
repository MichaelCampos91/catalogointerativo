import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getProductionBatchOrders } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

type RouteContext = { params: Promise<{ batchId: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }
  try {
    const { batchId } = await context.params
    if (!batchId) {
      return NextResponse.json({ error: "batchId é obrigatório" }, { status: 400 })
    }
    const orders = await getProductionBatchOrders(batchId)
    return NextResponse.json(orders)
  } catch (error) {
    console.error("API: Erro ao buscar pedidos do lote:", error)
    return NextResponse.json(
      {
        error: "Erro ao buscar pedidos do lote",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
