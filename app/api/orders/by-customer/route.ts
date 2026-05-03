import { NextResponse } from "next/server"
import { getOrdersByCustomerName } from "@/lib/database"

/**
 * Endpoint público que retorna a lista de pedidos confirmados (não cancelados)
 * de um cliente, identificado pelo nome (campo "nome" da URL do cliente).
 *
 * Importante: NÃO retorna `whatsapp_message` nem outros campos sensíveis.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = (searchParams.get("name") ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "Parâmetro 'name' é obrigatório" }, { status: 400 })
    }
    const orders = await getOrdersByCustomerName(name)
    return NextResponse.json({ orders })
  } catch (error) {
    console.error("API: Erro ao listar pedidos do cliente:", error)
    return NextResponse.json(
      {
        error: "Erro ao listar pedidos",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
