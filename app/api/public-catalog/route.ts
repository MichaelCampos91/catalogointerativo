import type { NextRequest } from "next/server"
import { buildCatalogResponse } from "@/app/api/files/route"
import { recordCatalogSearch } from "@/lib/database"
import { completedSearchTerm } from "@/lib/search"

// Endpoint público somente leitura para o catálogo do cliente
// Não exige autenticação e reutiliza exatamente a mesma lógica de listagem do R2

export async function GET(request: NextRequest) {
  const response = await buildCatalogResponse(request)

  try {
    if (response.status === 200) {
      const { searchParams } = new URL(request.url)
      const page = Number.parseInt(searchParams.get("page") || "1", 10)
      if (page === 1) {
        const term = completedSearchTerm(searchParams.get("search") || "")
        if (term) {
          await recordCatalogSearch(term)
        }
      }
    }
  } catch (error) {
    console.error("Erro ao registrar busca do catálogo:", error)
  }

  return response
}
