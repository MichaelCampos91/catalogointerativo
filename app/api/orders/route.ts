import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createOrder, getOrders, updateOrderStatus, getOrdersByOrderNumber, markOrdersInProduction, finalizeOrders, getOrderById, getOrdersByIds, cancelOrder, getOrdersFiltered, getOrderIdsFiltered, createProductionBatch } from "@/lib/database"
import type { OrderStatusFilter } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    console.log("API: Criando novo pedido...")
    const body = await request.json()
    const order = await createOrder(body)
    console.log("API: Pedido criado com sucesso")
    return NextResponse.json(order)
  } catch (error) {
    console.error("API: Erro ao criar pedido:", error)
    // Garantir que sempre retornamos JSON válido mesmo em caso de erro
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

const VALID_STATUSES: OrderStatusFilter[] = ["pending", "art_mounted", "in_production", "finalized", "canceled"]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get("order")
    const idsParam = searchParams.get("ids")
    const isAdminList = !orderNumber && !idsParam
    if (isAdminList) {
      try {
        const cookieStore = await cookies()
        const cookieToken = cookieStore.get("auth_token")?.value
        await requireAuth(request, cookieToken)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Token não fornecido"
        return authErrorResponse(msg, 401)
      }
    }
    if (orderNumber) {
      const orders = await getOrdersByOrderNumber(orderNumber)
      return NextResponse.json(orders)
    }
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      if (ids.length > 0) {
        const orders = await getOrdersByIds(ids)
        return NextResponse.json(orders)
      }
    }

    const statusParam = searchParams.get("status")
    const statusesParam = searchParams.getAll("status")
    const statuses = statusesParam.length > 0 ? statusesParam : (statusParam ? [statusParam] : [])
    const validStatuses = statuses.filter((s): s is OrderStatusFilter => VALID_STATUSES.includes(s as OrderStatusFilter))
    const periodFrom = searchParams.get("periodFrom") ?? undefined
    const periodTo = searchParams.get("periodTo") ?? undefined
    const search = searchParams.get("search") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))
    const idsOnly = searchParams.get("idsOnly") === "true"

    if (validStatuses.length > 0) {
      if (idsOnly) {
        const ids = await getOrderIdsFiltered({
          statuses: validStatuses,
          periodFrom,
          periodTo,
          search,
        })
        return NextResponse.json(ids)
      }
      const result = await getOrdersFiltered({
        statuses: validStatuses,
        periodFrom,
        periodTo,
        search,
        page,
        pageSize,
      })
      return NextResponse.json({
        orders: result.orders,
        total: result.total,
        page,
        pageSize,
      })
    }

    const includeCanceled = searchParams.get("includeCanceled") === "true"
    const orders = await getOrders(includeCanceled)
    return NextResponse.json(orders)
  } catch (error) {
    console.error("API: Erro ao buscar pedidos:", error)
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }
  try {
    const body = await request.json()
    const { id, finalize, orderIds, cancel } = body

    // PATCH para finalizar pedidos
    if (finalize && Array.isArray(orderIds)) {
      const updatedOrders = await finalizeOrders(orderIds)
      return NextResponse.json(updatedOrders)
    }

    // PATCH para cancelar pedido
    if (cancel && id) {
      console.log(`API: Cancelando pedido ${id}...`)
      const order = await getOrderById(id)
      if (!order) {
        return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
      }
      if (order.finalized_at) {
        return NextResponse.json({ error: "Pedido já está finalizado e não pode ser cancelado" }, { status: 400 })
      }
      if (order.canceled_at) {
        return NextResponse.json({ error: "Pedido já está cancelado" }, { status: 400 })
      }
      const updatedOrder = await cancelOrder(id)
      return NextResponse.json(updatedOrder)
    }

    if (!id) {
      return NextResponse.json({ error: "ID do pedido é obrigatório" }, { status: 400 })
    }

    // Antes de concluir, garantir que não está finalizado
    const orders = await getOrdersByOrderNumber(id)
    if (orders.length === 0 || orders[0].finalized_at) {
      return NextResponse.json({ error: "Pedido já finalizado ou não encontrado" }, { status: 400 })
    }

    console.log(`API: Concluindo pedido ${id}...`)
    const updatedOrder = await updateOrderStatus(orders[0].id, false)

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("API: Erro ao processar pedido:", error)
    return NextResponse.json(
      {
        error: "Erro ao processar pedido",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }
  try {
    const body = await request.json()
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "IDs dos pedidos são obrigatórios e devem ser um array não vazio" }, { status: 400 })
    }

    // Antes de marcar em produção, garantir que não estão finalizados
    // (busca todos os pedidos e verifica)
    // Se algum estiver finalizado, retorna erro
    const orders = await Promise.all(orderIds.map((id: string) => getOrderById(id)))
    if (orders.some(order => !order || order.finalized_at)) {
      return NextResponse.json({ error: "Alguns pedidos já estão finalizados ou não encontrados" }, { status: 400 })
    }

    console.log(`API: Marcando ${orderIds.length} pedido(s) como em produção...`)
    const updatedOrders = await markOrdersInProduction(orderIds)
    await createProductionBatch(orderIds)

    return NextResponse.json(updatedOrders)
  } catch (error) {
    console.error("API: Erro ao marcar pedidos como em produção:", error)
    return NextResponse.json(
      {
        error: "Erro ao marcar pedidos como em produção",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
