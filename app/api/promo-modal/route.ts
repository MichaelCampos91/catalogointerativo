import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import { createPromoModal, ensurePromoModalTable, listPromoModals } from "@/lib/database"
import { parsePromoModalPayload } from "@/lib/promo-modal"

async function auth(request: Request) {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get("auth_token")?.value
  await requireAuth(request, cookieToken)
}

export async function GET(request: Request) {
  try {
    await auth(request)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    await ensurePromoModalTable()
    const modals = await listPromoModals()
    return NextResponse.json({ modals })
  } catch (error) {
    console.error("API: Erro ao listar modais promocionais:", error)
    return NextResponse.json(
      { error: "Erro ao listar modais", message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await auth(request)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    await ensurePromoModalTable()
    const body = await request.json().catch(() => null)
    const parsed = parsePromoModalPayload(body)
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.message }, { status: 400 })
    }
    const modal = await createPromoModal(parsed.value)
    return NextResponse.json({ modal }, { status: 201 })
  } catch (error) {
    console.error("API: Erro ao criar modal promocional:", error)
    return NextResponse.json(
      { error: "Erro ao criar modal", message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}
