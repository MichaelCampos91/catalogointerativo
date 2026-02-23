import { cookies } from "next/headers"
import { requireAuth, authErrorResponse } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)

    return Response.json({
      user: { id: "admin", email: "admin@catalogo.local" },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Token não fornecido"
    if (message === "Token não fornecido" || message === "Token inválido ou expirado") {
      return authErrorResponse(message, 401)
    }
    return authErrorResponse("Erro ao verificar autenticação", 500)
  }
}
