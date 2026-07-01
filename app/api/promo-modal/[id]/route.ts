import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import {
  deletePromoModal,
  ensurePromoModalTable,
  setPromoModalActive,
  updatePromoModal,
} from "@/lib/database"
import { parsePromoModalPayload } from "@/lib/promo-modal"

type RouteContext = { params: Promise<{ id: string }> }

async function auth(request: Request) {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get("auth_token")?.value
  await requireAuth(request, cookieToken)
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await auth(request)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    await ensurePromoModalTable()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
    }
    const body = await request.json().catch(() => null)
    const parsed = parsePromoModalPayload(body)
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.message }, { status: 400 })
    }
    const modal = await updatePromoModal(id, parsed.value)
    return NextResponse.json({ modal })
  } catch (error) {
    console.error("API: Erro ao atualizar modal promocional:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isClientError = /não encontrado/i.test(message)
    return NextResponse.json({ error: message }, { status: isClientError ? 404 : 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await auth(request)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    await ensurePromoModalTable()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
    }
    const body = await request.json().catch(() => ({}))
    if (typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "active (boolean) é obrigatório" }, { status: 400 })
    }
    const modal = await setPromoModalActive(id, body.active)
    return NextResponse.json({ modal })
  } catch (error) {
    console.error("API: Erro ao alterar status do modal promocional:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isClientError = /não encontrado/i.test(message)
    return NextResponse.json({ error: message }, { status: isClientError ? 404 : 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await auth(request)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    await ensurePromoModalTable()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
    }
    await deletePromoModal(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("API: Erro ao excluir modal promocional:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isClientError = /não encontrado/i.test(message)
    return NextResponse.json({ error: message }, { status: isClientError ? 404 : 500 })
  }
}
