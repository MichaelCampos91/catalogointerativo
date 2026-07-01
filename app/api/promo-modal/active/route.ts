import { NextResponse } from "next/server"
import { ensurePromoModalTable, getActivePromoModal } from "@/lib/database"

/**
 * Endpoint público: retorna o modal promocional ativo (ou null). O HTML já foi
 * sanitizado no momento do salvamento. Somente leitura.
 */
export async function GET() {
  try {
    await ensurePromoModalTable()
    const modal = await getActivePromoModal()
    if (!modal) {
      return NextResponse.json({ modal: null })
    }
    return NextResponse.json(
      { modal },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("API: Erro ao buscar modal ativo:", error)
    return NextResponse.json({ modal: null })
  }
}
