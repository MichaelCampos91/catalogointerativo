import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { cancelOrderLink } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Atualiza um link existente. Hoje suporta apenas a ação de cancelar
 * (status -> 'cancelled') via body `{ action: 'cancel' }`.
 *
 * Regras:
 *  - Apenas links com status `pending` podem ser cancelados manualmente.
 *  - Links `confirmed` precisam ser cancelados via cancelamento do pedido em
 *    /orders (que propaga automaticamente para o link).
 *  - Cancelar um link já `cancelled` é no-op (idempotente).
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === "string" ? body.action : null
    if (action !== "cancel") {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    const link = await cancelOrderLink(id)
    return NextResponse.json({ link })
  } catch (error) {
    console.error("API: Erro ao atualizar link:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isClientError = /não encontrado|já foi confirmado|inválid/i.test(message)
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 },
    )
  }
}
