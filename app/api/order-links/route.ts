import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  createOrderLink,
  getOrderLinksFiltered,
  getAppSetting,
  type OrderLinkStatus,
} from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import { buildClientOrderLink } from "@/lib/order-links"

const VALID_STATUSES: OrderLinkStatus[] = ["pending", "confirmed"]

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }

    const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : ""
    const orderNumber = typeof body.order_number === "string" ? body.order_number.trim() : ""
    const quantity = Number(body.quantity)
    const messageTemplateRaw = typeof body.message_template === "string" ? body.message_template : null

    if (!customerName) {
      return NextResponse.json({ error: "Nome do cliente é obrigatório" }, { status: 400 })
    }
    if (!orderNumber) {
      return NextResponse.json({ error: "Número do pedido é obrigatório" }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
      return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 })
    }

    const generatedUrl = buildClientOrderLink({
      name: customerName,
      orderNumber,
      quantity,
      origin: request.headers.get("origin"),
    })

    let messageTemplate = messageTemplateRaw
    if (messageTemplate === null) {
      const stored = await getAppSetting("default_link_message")
      messageTemplate = stored ?? ""
    }
    const finalMessage = messageTemplate
      ? messageTemplate.replace(/{{\s*link gerado\s*}}/gi, generatedUrl)
      : null

    const link = await createOrderLink({
      customer_name: customerName,
      order_number: orderNumber,
      quantity,
      message: finalMessage,
      message_template: messageTemplate,
      generated_url: generatedUrl,
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error("API: Erro ao criar link:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isClientError = /já existe|inválid|obrigatóri|suportada/i.test(message)
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const statusesParam = searchParams.getAll("status")
    const statuses = statusesParam.filter((s): s is OrderLinkStatus =>
      VALID_STATUSES.includes(s as OrderLinkStatus),
    )
    const periodFrom = searchParams.get("periodFrom") ?? undefined
    const periodTo = searchParams.get("periodTo") ?? undefined
    const periodFieldRaw = searchParams.get("periodField")
    const periodField: "created" | "confirmed" =
      periodFieldRaw === "confirmed" ? "confirmed" : "created"
    const search = searchParams.get("search") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

    const result = await getOrderLinksFiltered({
      statuses: statuses.length > 0 ? statuses : undefined,
      periodFrom,
      periodTo,
      periodField,
      search,
      page,
      pageSize,
    })
    return NextResponse.json({
      links: result.links,
      total: result.total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("API: Erro ao listar links:", error)
    return NextResponse.json(
      {
        error: "Erro ao listar links",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
