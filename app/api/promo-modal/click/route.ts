import { NextResponse } from "next/server"
import { ensurePromoModalTable, incrementPromoModalClick } from "@/lib/database"

/**
 * Endpoint público: incrementa o contador de cliques do botão de um modal.
 * Body: { id }. Contagem total (sem distinguir visitantes).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === "string" ? body.id : null
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
    }
    await ensurePromoModalTable()
    await incrementPromoModalClick(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("API: Erro ao registrar clique do modal:", error)
    return NextResponse.json({ error: "Erro ao registrar clique" }, { status: 500 })
  }
}
