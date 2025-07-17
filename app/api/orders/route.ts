import { NextResponse } from "next/server"
import { createOrder, getOrders, getOrdersByDate, getOrdersByCompletionDate, getOrdersByProductionDate, updateOrderStatus, getOrdersByOrderNumber, markOrdersInProduction, finalizeOrders } from "@/lib/database"

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const completionDate = searchParams.get("completionDate")
    const productionDate = searchParams.get("productionDate")
    const orderNumber = searchParams.get("order")

    let orders
    if (orderNumber) {
      orders = await getOrdersByOrderNumber(orderNumber)
    } else if (productionDate) {
      orders = await getOrdersByProductionDate(productionDate)
    } else if (completionDate) {
      orders = await getOrdersByCompletionDate(completionDate)
    } else if (date) {
      orders = await getOrdersByDate(date)
    } else {
      orders = await getOrders()
    }

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
    const body = await request.json()
    const { id, finalize, orderIds } = body

    // PATCH para finalizar pedidos
    if (finalize && Array.isArray(orderIds)) {
      const updatedOrders = await finalizeOrders(orderIds)
      return NextResponse.json(updatedOrders)
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
    const updatedOrder = await updateOrderStatus(id, false)

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("API: Erro ao concluir pedido:", error)
    return NextResponse.json(
      {
        error: "Erro ao concluir pedido",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "IDs dos pedidos são obrigatórios e devem ser um array não vazio" }, { status: 400 })
    }

    // Antes de marcar em produção, garantir que não estão finalizados
    // (busca todos os pedidos e verifica)
    // Se algum estiver finalizado, retorna erro
    const orders = await Promise.all(orderIds.map((id: string) => getOrdersByOrderNumber(id)))
    if (orders.some(orderArr => orderArr.length === 0 || orderArr[0].finalized_at)) {
      return NextResponse.json({ error: "Alguns pedidos já estão finalizados ou não encontrados" }, { status: 400 })
    }

    console.log(`API: Marcando ${orderIds.length} pedido(s) como em produção...`)
    const updatedOrders = await markOrdersInProduction(orderIds)

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
