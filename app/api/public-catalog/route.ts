import type { NextRequest } from "next/server"
import { buildCatalogResponse } from "@/app/api/files/route"

// Endpoint público somente leitura para o catálogo do cliente
// Não exige autenticação e reutiliza exatamente a mesma lógica de listagem do R2

export async function GET(request: NextRequest) {
  return buildCatalogResponse(request)
}

