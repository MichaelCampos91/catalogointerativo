import { NextResponse } from "next/server"
import {
  getOrderLinkByOrderNumber,
  checkOrderExists,
  getAppSettingBoolean,
} from "@/lib/database"
import { getLinkExpirationSettings } from "@/lib/link-expiration"

/**
 * Endpoint público que valida o trio (nome, pedido, quantidade) recebido pela
 * raiz do site. Retorna como o cliente deve ser tratado.
 *
 * Resultados possíveis:
 *  - 'allowed'   → link existe e está pendente, e os dados conferem.
 *                  Inclui `expiresAt` (ISO ou null) para o cronômetro do cliente.
 *  - 'confirmed' → link já foi confirmado, OU não existe link mas o pedido já
 *                   foi criado anteriormente (legacy). Cliente deve ir para
 *                   /confirmed/{orderNumber}.
 *  - 'expired'   → link pendente cujo expires_at já passou. Inclui `message`.
 *  - 'invalid'   → link inexistente OU dados não conferem.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ result: "invalid", reason: "payload" }, { status: 200 })
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : ""
    const quantity = Number(body.quantity)

    if (!name || !orderNumber || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ result: "invalid", reason: "params" }, { status: 200 })
    }

    const link = await getOrderLinkByOrderNumber(orderNumber)
    if (link) {
      if (link.status === "confirmed") {
        return NextResponse.json({ result: "confirmed" }, { status: 200 })
      }
      if (link.status === "cancelled") {
        // Link cancelado: trata como inválido para encerrar o acesso pelo cliente.
        return NextResponse.json({ result: "invalid", reason: "cancelled" }, { status: 200 })
      }
      const matchesName = link.customer_name.trim().toLowerCase() === name.toLowerCase()
      const matchesQty = link.quantity === quantity
      if (!matchesName || !matchesQty) {
        return NextResponse.json({ result: "invalid", reason: "mismatch" }, { status: 200 })
      }

      // Link pending: verifica expiração (snapshot em expires_at).
      if (link.expires_at) {
        const expiresMs = new Date(link.expires_at).getTime()
        if (Number.isFinite(expiresMs) && expiresMs < Date.now()) {
          const { message } = await getLinkExpirationSettings()
          return NextResponse.json(
            { result: "expired", message, reason: "expired" },
            { status: 200 },
          )
        }
      }

      return NextResponse.json(
        {
          result: "allowed",
          expiresAt: link.expires_at ? new Date(link.expires_at).toISOString() : null,
        },
        { status: 200 },
      )
    }

    // Sem link cadastrado: trata pedidos legados (já confirmados antes do refactor).
    const legacyExists = await checkOrderExists(orderNumber)
    if (legacyExists) {
      return NextResponse.json({ result: "confirmed", legacy: true }, { status: 200 })
    }

    // Quando a restrição de acesso ao catálogo está desligada, links não
    // registrados podem entrar em modo pedido normalmente. O auto-registro
    // (se ativo) é feito apenas no momento da confirmação do pedido.
    const restricted = await getAppSettingBoolean("catalog_access_restricted", true)
    if (!restricted) {
      return NextResponse.json(
        { result: "allowed", reason: "unrestricted", expiresAt: null },
        { status: 200 },
      )
    }

    return NextResponse.json({ result: "invalid", reason: "not_registered" }, { status: 200 })
  } catch (error) {
    console.error("API: Erro ao validar link:", error)
    return NextResponse.json(
      {
        result: "invalid",
        reason: "server_error",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
