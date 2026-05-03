import { Pool } from "pg"

// Configuração do pool usando variáveis de ambiente
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 10,
})

// Log de eventos do pool
pool.on("error", (err) => {
  console.error("Erro inesperado no pool de conexões:", err)
})

// Verificar se as variáveis de ambiente estão definidas
if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("❌ Variáveis de ambiente do banco de dados não estão definidas!")
  console.error("Certifique-se de que DB_HOST, DB_NAME, DB_USER e DB_PASSWORD estão no arquivo .env.local")
}

export type Order = {
  id: string
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  whatsapp_message: string | null
  created_at: string
  updated_at: string
  is_pending: boolean
  in_production: boolean
  in_production_at: string | null
  finalized_at: string | null
  canceled_at: string | null
}

export type CreateOrder = {
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  whatsapp_message: string | null
  order: string
}

// Funções para pedidos
export async function getOrders(includeCanceled: boolean = false): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const query = includeCanceled 
      ? "SELECT * FROM orders ORDER BY created_at ASC"
      : "SELECT * FROM orders WHERE canceled_at IS NULL ORDER BY created_at ASC"
    const result = await client.query(query)
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
      updated_at: row.updated_at, 
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar todos os pedidos cancelados
export async function getAllCanceledOrders(): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query("SELECT * FROM orders WHERE canceled_at IS NOT NULL ORDER BY canceled_at DESC")
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos cancelados:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedidos por data
export async function getOrdersByDate(date: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders 
       WHERE DATE(created_at) = $1 
       ORDER BY created_at ASC`,
      [date],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por data:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedidos por data de conclusão
export async function getOrdersByCompletionDate(date: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders 
       WHERE DATE(updated_at) = $1 AND is_pending = false
       ORDER BY updated_at ASC`,
      [date],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por data de conclusão:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedidos por data de produção
export async function getOrdersByProductionDate(date: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders 
       WHERE DATE(in_production_at) = $1 AND in_production = true
       ORDER BY in_production_at ASC`,
      [date],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por data de produção:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedidos por data de cancelamento
export async function getOrdersByCanceledDate(date: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders 
       WHERE DATE(canceled_at) = $1 AND canceled_at IS NOT NULL
       ORDER BY canceled_at ASC`,
      [date],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por data de cancelamento:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export type OrderStatusFilter = "pending" | "art_mounted" | "in_production" | "finalized" | "canceled"

/** Campo de data usado no filtro por período (alinhado à coluna Data no admin). */
export type OrderPeriodField = "created" | "art_mounted" | "in_production" | "finalized" | "canceled"

const VALID_PERIOD_FIELDS: OrderPeriodField[] = [
  "created",
  "art_mounted",
  "in_production",
  "finalized",
  "canceled",
]

export function normalizePeriodField(value: string | undefined): OrderPeriodField {
  if (value && VALID_PERIOD_FIELDS.includes(value as OrderPeriodField)) {
    return value as OrderPeriodField
  }
  return "created"
}

/** Adiciona condições DATE(col) >= / <= para periodFrom/periodTo; retorna novo paramIndex. */
function appendPeriodConditions(
  conditions: string[],
  params: unknown[],
  paramIndex: number,
  periodFrom: string | undefined,
  periodTo: string | undefined,
  periodField: OrderPeriodField,
): number {
  if (!periodFrom && !periodTo) return paramIndex

  let dateExpr: string
  const extraNotNull: string[] = []
  switch (periodField) {
    case "created":
      dateExpr = "created_at"
      break
    case "art_mounted":
      dateExpr = "updated_at"
      break
    case "in_production":
      dateExpr = "in_production_at"
      extraNotNull.push("in_production_at IS NOT NULL")
      break
    case "finalized":
      dateExpr = "finalized_at"
      extraNotNull.push("finalized_at IS NOT NULL")
      break
    case "canceled":
      dateExpr = "canceled_at"
      extraNotNull.push("canceled_at IS NOT NULL")
      break
    default:
      dateExpr = "created_at"
  }
  for (const c of extraNotNull) {
    conditions.push(c)
  }
  if (periodFrom) {
    conditions.push(`DATE(${dateExpr}) >= $${paramIndex}`)
    params.push(periodFrom)
    paramIndex++
  }
  if (periodTo) {
    conditions.push(`DATE(${dateExpr}) <= $${paramIndex}`)
    params.push(periodTo)
    paramIndex++
  }
  return paramIndex
}

export type GetOrdersFilteredOptions = {
  statuses: OrderStatusFilter[]
  periodFrom?: string
  periodTo?: string
  /** Qual coluna de data usar no filtro de período; default created (created_at). */
  periodField?: OrderPeriodField
  search?: string
  quantity?: number
  page: number
  pageSize: number
}

export type GetOrdersFilteredResult = {
  orders: Order[]
  total: number
}

// Função para buscar pedidos com filtros (status, período, busca) e paginação
export async function getOrdersFiltered(options: GetOrdersFilteredOptions): Promise<GetOrdersFilteredResult> {
  const { statuses, periodFrom, periodTo, periodField = "created", search, quantity, page, pageSize } = options
  if (!statuses || statuses.length === 0) {
    return { orders: [], total: 0 }
  }

  let client
  try {
    client = await pool.connect()

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    const statusConditions: string[] = []
    if (statuses.includes("pending")) {
      statusConditions.push(`(is_pending = true AND canceled_at IS NULL)`)
    }
    if (statuses.includes("art_mounted")) {
      statusConditions.push(
        `(is_pending = false AND (in_production = false OR in_production IS NULL) AND finalized_at IS NULL AND canceled_at IS NULL)`
      )
    }
    if (statuses.includes("in_production")) {
      statusConditions.push(
        `(in_production = true AND finalized_at IS NULL AND canceled_at IS NULL)`
      )
    }
    if (statuses.includes("finalized")) {
      statusConditions.push(`(finalized_at IS NOT NULL AND canceled_at IS NULL)`)
    }
    if (statuses.includes("canceled")) {
      statusConditions.push(`(canceled_at IS NOT NULL)`)
    }
    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(" OR ")})`)
    }

    paramIndex = appendPeriodConditions(conditions, params, paramIndex, periodFrom, periodTo, periodField)

    if (search && search.trim()) {
      conditions.push(`(customer_name ILIKE $${paramIndex} OR "order" ILIKE $${paramIndex})`)
      params.push(`%${search.trim()}%`)
      paramIndex++
    }

    if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) {
      conditions.push(`quantity_purchased = $${paramIndex}`)
      params.push(quantity)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const countResult = await client.query(
      `SELECT COUNT(*) FROM orders ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const offset = (page - 1) * pageSize
    const limitParam = `$${paramIndex}`
    const offsetParam = `$${paramIndex + 1}`
    const queryParams = [...params, pageSize, offset]

    const result = await client.query(
      `SELECT * FROM orders ${whereClause} ORDER BY created_at ASC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      queryParams
    )

    const orders = result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
      updated_at: row.updated_at,
    }))

    return { orders, total }
  } catch (error) {
    console.error("Erro ao buscar pedidos filtrados:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar apenas IDs de pedidos com os mesmos filtros (para "selecionar todos")
export async function getOrderIdsFiltered(options: Omit<GetOrdersFilteredOptions, "page" | "pageSize">): Promise<string[]> {
  const { statuses, periodFrom, periodTo, periodField = "created", search, quantity } = options
  if (!statuses || statuses.length === 0) {
    return []
  }

  let client
  try {
    client = await pool.connect()

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    const statusConditions: string[] = []
    if (statuses.includes("pending")) {
      statusConditions.push(`(is_pending = true AND canceled_at IS NULL)`)
    }
    if (statuses.includes("art_mounted")) {
      statusConditions.push(
        `(is_pending = false AND (in_production = false OR in_production IS NULL) AND finalized_at IS NULL AND canceled_at IS NULL)`
      )
    }
    if (statuses.includes("in_production")) {
      statusConditions.push(
        `(in_production = true AND finalized_at IS NULL AND canceled_at IS NULL)`
      )
    }
    if (statuses.includes("finalized")) {
      statusConditions.push(`(finalized_at IS NOT NULL AND canceled_at IS NULL)`)
    }
    if (statuses.includes("canceled")) {
      statusConditions.push(`(canceled_at IS NOT NULL)`)
    }
    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(" OR ")})`)
    }
    paramIndex = appendPeriodConditions(conditions, params, paramIndex, periodFrom, periodTo, periodField)

    if (search && search.trim()) {
      conditions.push(`(customer_name ILIKE $${paramIndex} OR "order" ILIKE $${paramIndex})`)
      params.push(`%${search.trim()}%`)
      paramIndex++
    }

    if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) {
      conditions.push(`quantity_purchased = $${paramIndex}`)
      params.push(quantity)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const result = await client.query(
      `SELECT id FROM orders ${whereClause} ORDER BY created_at ASC`,
      params
    )
    return result.rows.map((r) => r.id)
  } catch (error) {
    console.error("Erro ao buscar IDs de pedidos filtrados:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedidos por número do pedido
export async function getOrdersByOrderNumber(orderNumber: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders 
       WHERE "order" = $1 
       ORDER BY created_at ASC`,
      [orderNumber],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por número:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para verificar se já existe um pedido com o mesmo número
export async function checkOrderExists(orderNumber: string): Promise<boolean> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      'SELECT COUNT(*) FROM orders WHERE "order" = $1',
      [orderNumber]
    )
    return parseInt(result.rows[0].count) > 0
  } catch (error) {
    console.error("Erro ao verificar pedido duplicado:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

/**
 * Retorna os códigos de imagem mais frequentes em pedidos dos últimos N dias.
 * Exclui pedidos cancelados. Apenas leitura; usa jsonb_array_elements_text.
 */
export async function getTrendingImageCodes(
  limit: number = 30,
  days: number = 7
): Promise<string[]> {
  let client
  try {
    client = await pool.connect()
    const safeLimit = Math.min(Math.max(1, limit), 50)
    const safeDays = Math.min(Math.max(1, days), 90)
    const result = await client.query(
      `SELECT elem AS code
       FROM orders o,
            jsonb_array_elements_text(o.selected_images) AS elem
       WHERE o.created_at >= NOW() - ($2 * INTERVAL '1 day')
         AND o.canceled_at IS NULL
       GROUP BY elem
       ORDER BY COUNT(*) DESC
       LIMIT $1`,
      [safeLimit, safeDays]
    )
    return result.rows.map((row: { code: string }) => row.code)
  } catch (error) {
    console.error("Erro ao buscar códigos em tendência:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para criar um novo pedido
export async function createOrder(order: CreateOrder): Promise<Order> {
  let client
  try {
    if (!Number.isInteger(order.quantity_purchased) || order.quantity_purchased <= 0) {
      throw new Error("Quantidade do pedido inválida")
    }
    if (
      !Array.isArray(order.selected_images) ||
      order.selected_images.some((item) => typeof item !== "string" || !item.trim())
    ) {
      throw new Error("Itens selecionados inválidos")
    }
    if (order.selected_images.length !== order.quantity_purchased) {
      throw new Error("A quantidade de itens selecionados deve ser igual à quantidade do pedido")
    }

    // Verifica se já existe um pedido com o mesmo número
    const orderExists = await checkOrderExists(order.order)
    if (orderExists) {
      throw new Error("Já existe um pedido com este número")
    }

    client = await pool.connect()
    const result = await client.query(
      `INSERT INTO orders (customer_name, quantity_purchased, selected_images, whatsapp_message, "order") 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [order.customer_name, order.quantity_purchased, JSON.stringify(order.selected_images), order.whatsapp_message, order.order],
    )
    return {
      ...result.rows[0],
      selected_images: result.rows[0].selected_images,
    }
  } catch (error) {
    console.error("Erro ao criar pedido:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para testar conexão
export async function testConnection(): Promise<boolean> {
  let client
  try {
    client = await pool.connect()
    await client.query("SELECT 1")
    return true
  } catch (error) {
    console.error("Erro na conexão com o banco:", error)
    return false
  } finally {
    if (client) client.release()
  }
}

// Função para obter informações de configuração
export function getDatabaseConfig() {
  return {
    host: process.env.DB_HOST ? "✅ Definido" : "❌ Não definido",
    port: process.env.DB_PORT ? "✅ Definido" : "❌ Não definido",
    database: process.env.DB_NAME ? "✅ Definido" : "❌ Não definido",
    user: process.env.DB_USER ? "✅ Definido" : "❌ Não definido",
    password: process.env.DB_PASSWORD ? "✅ Definido" : "❌ Não definido",
  }
}

// Função para atualizar o status do pedido
export async function updateOrderStatus(id: string, isPending: boolean): Promise<Order> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `UPDATE orders 
       SET is_pending = $1, updated_at = NOW()
       WHERE id = $2 
       RETURNING *`,
      [isPending, id],
    )
    if (result.rows.length === 0) {
      throw new Error("Pedido não encontrado")
    }
    return {
      ...result.rows[0],
      selected_images: result.rows[0].selected_images,
      updated_at: result.rows[0].updated_at,
    }
  } catch (error) {
    console.error("Erro ao atualizar status do pedido:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para marcar pedidos como "em produção"
export async function markOrdersInProduction(orderIds: string[]): Promise<Order[]> {
  let client
  try {
    if (orderIds.length === 0) {
      throw new Error("Nenhum pedido selecionado")
    }

    client = await pool.connect()
    
    // Verificar se todos os pedidos existem e não estão em produção
    const checkResult = await client.query(
      `SELECT id FROM orders 
       WHERE id = ANY($1) AND (in_production = false OR in_production IS NULL)`,
      [orderIds]
    )
    
    if (checkResult.rows.length !== orderIds.length) {
      throw new Error("Alguns pedidos não foram encontrados ou já estão em produção")
    }

    // Marcar pedidos como em produção
    const result = await client.query(
      `UPDATE orders 
       SET in_production = true, in_production_at = NOW()
       WHERE id = ANY($1) 
       RETURNING *`,
      [orderIds],
    )
    
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
      updated_at: row.updated_at,
      in_production_at: row.in_production_at,
    }))
  } catch (error) {
    console.error("Erro ao marcar pedidos como em produção:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para finalizar pedidos (atualizar finalized_at)
export async function finalizeOrders(orderIds: string[]): Promise<Order[]> {
  let client
  try {
    if (orderIds.length === 0) {
      throw new Error("Nenhum pedido selecionado")
    }
    client = await pool.connect()
    // Só finaliza pedidos que NÃO estão finalizados
    const checkResult = await client.query(
      `SELECT id FROM orders WHERE id = ANY($1) AND finalized_at IS NULL`,
      [orderIds]
    )
    if (checkResult.rows.length !== orderIds.length) {
      throw new Error("Alguns pedidos já estão finalizados")
    }
    const result = await client.query(
      `UPDATE orders SET finalized_at = NOW() WHERE id = ANY($1) AND finalized_at IS NULL RETURNING *`,
      [orderIds]
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
    }))
  } catch (error) {
    console.error("Erro ao finalizar pedidos:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar vários pedidos por IDs (para lista/dialog)
export async function getOrdersByIds(ids: string[]): Promise<Order[]> {
  if (ids.length === 0) return []
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders WHERE id = ANY($1) ORDER BY created_at ASC`,
      [ids],
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
      updated_at: row.updated_at,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por IDs:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para buscar pedido por UUID
export async function getOrderById(id: string): Promise<Order | null> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id],
    )
    if (result.rows.length === 0) return null
    return {
      ...result.rows[0],
      selected_images: result.rows[0].selected_images,
    }
  } catch (error) {
    console.error("Erro ao buscar pedido por ID:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// Função para cancelar um pedido
export async function cancelOrder(id: string): Promise<Order> {
  let client
  try {
    client = await pool.connect()
    await client.query("BEGIN")

    // Verificar se o pedido existe e não está cancelado ou finalizado
    const checkResult = await client.query(
      `SELECT id, canceled_at, finalized_at FROM orders WHERE id = $1`,
      [id]
    )

    if (checkResult.rows.length === 0) {
      throw new Error("Pedido não encontrado")
    }

    const order = checkResult.rows[0]
    if (order.canceled_at) {
      throw new Error("Pedido já está cancelado")
    }

    if (order.finalized_at) {
      throw new Error("Pedido já está finalizado e não pode ser cancelado")
    }

    // Cancelar o pedido
    const result = await client.query(
      `UPDATE orders
       SET canceled_at = NOW()
       WHERE id = $1 AND canceled_at IS NULL AND finalized_at IS NULL
       RETURNING *`,
      [id],
    )

    if (result.rows.length === 0) {
      throw new Error("Não foi possível cancelar o pedido")
    }

    // Propaga o cancelamento para o link associado (se existir).
    // No-op quando não há link cadastrado para o pedido.
    await client.query(
      `UPDATE order_links
          SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = $1
          AND status <> 'cancelled'`,
      [id]
    )

    await client.query("COMMIT")

    return {
      ...result.rows[0],
      selected_images: result.rows[0].selected_images,
    }
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK")
      } catch (rollbackError) {
        console.error("Erro ao executar ROLLBACK em cancelOrder:", rollbackError)
      }
    }
    console.error("Erro ao cancelar pedido:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// --- Histórico de Produção (lotes) ---

export type ProductionBatch = {
  id: string
  created_at: string
  order_count?: number
}

export async function createProductionBatch(orderIds: string[]): Promise<{ batchId: string; createdAt: string }> {
  let client
  try {
    if (orderIds.length === 0) {
      throw new Error("Nenhum pedido para criar lote")
    }
    client = await pool.connect()
    const batchResult = await client.query(
      `INSERT INTO production_batches (id, created_at) VALUES (gen_random_uuid(), NOW()) RETURNING id, created_at`
    )
    const batch = batchResult.rows[0]
    const batchId = batch.id
    const createdAt = batch.created_at

    for (const orderId of orderIds) {
      await client.query(
        `INSERT INTO production_batch_orders (batch_id, order_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [batchId, orderId]
      )
    }
    return { batchId, createdAt }
  } catch (error) {
    console.error("Erro ao criar lote de produção:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export type GetProductionBatchesOptions = {
  periodFrom?: string
  periodTo?: string
  page?: number
  pageSize?: number
}

export async function getProductionBatches(
  options: GetProductionBatchesOptions = {}
): Promise<{ batches: (ProductionBatch & { order_count: number })[]; total: number }> {
  let client
  try {
    const { periodFrom, periodTo, page = 1, pageSize = 20 } = options
    client = await pool.connect()

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1
    if (periodFrom) {
      conditions.push(`DATE(pb.created_at) >= $${paramIndex}`)
      params.push(periodFrom)
      paramIndex++
    }
    if (periodTo) {
      conditions.push(`DATE(pb.created_at) <= $${paramIndex}`)
      params.push(periodTo)
      paramIndex++
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const countResult = await client.query(
      `SELECT COUNT(*) FROM production_batches pb ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const offset = (page - 1) * pageSize
    const limitParam = `$${paramIndex}`
    const offsetParam = `$${paramIndex + 1}`
    const queryParams = [...params, pageSize, offset]

    const result = await client.query(
      `SELECT pb.id, pb.created_at, COUNT(pbo.order_id)::int AS order_count
       FROM production_batches pb
       LEFT JOIN production_batch_orders pbo ON pbo.batch_id = pb.id
       ${whereClause}
       GROUP BY pb.id, pb.created_at
       ORDER BY pb.created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      queryParams
    )

    const batches = result.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      order_count: row.order_count,
    }))
    return { batches, total }
  } catch (error) {
    console.error("Erro ao buscar lotes de produção:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export async function getProductionBatchOrders(batchId: string): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT o.* FROM orders o
       INNER JOIN production_batch_orders pbo ON pbo.order_id = o.id
       WHERE pbo.batch_id = $1
       ORDER BY o.created_at ASC`,
      [batchId]
    )
    return result.rows.map((row) => ({
      ...row,
      selected_images: row.selected_images,
      updated_at: row.updated_at,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos do lote:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// --- Order Links (controle de acesso ao modo pedido) ---

export type OrderLinkStatus = "pending" | "confirmed" | "cancelled"

export type OrderLink = {
  id: string
  customer_name: string
  order_number: string
  quantity: number
  message: string | null
  message_template: string | null
  generated_url: string
  status: OrderLinkStatus
  created_at: string
  updated_at: string
  confirmed_at: string | null
  order_id: string | null
}

export type CreateOrderLink = {
  customer_name: string
  order_number: string
  quantity: number
  message: string | null
  message_template: string | null
  generated_url: string
}

export async function createOrderLink(input: CreateOrderLink): Promise<OrderLink> {
  let client
  try {
    if (!input.customer_name?.trim()) {
      throw new Error("Nome do cliente é obrigatório")
    }
    if (!input.order_number?.trim()) {
      throw new Error("Número do pedido é obrigatório")
    }
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error("Quantidade inválida")
    }
    if (!input.generated_url?.trim()) {
      throw new Error("URL gerada é obrigatória")
    }

    client = await pool.connect()

    const existing = await client.query(
      `SELECT id FROM order_links WHERE order_number = $1`,
      [input.order_number.trim()]
    )
    if (existing.rows.length > 0) {
      throw new Error("Já existe um link registrado para este número de pedido")
    }

    const result = await client.query(
      `INSERT INTO order_links
         (customer_name, order_number, quantity, message, message_template, generated_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.customer_name.trim(),
        input.order_number.trim(),
        input.quantity,
        input.message,
        input.message_template,
        input.generated_url,
      ]
    )
    return result.rows[0] as OrderLink
  } catch (error) {
    console.error("Erro ao criar link de pedido:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export async function getOrderLinkByOrderNumber(orderNumber: string): Promise<OrderLink | null> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT * FROM order_links WHERE order_number = $1`,
      [orderNumber]
    )
    if (result.rows.length === 0) return null
    return result.rows[0] as OrderLink
  } catch (error) {
    console.error("Erro ao buscar link por número de pedido:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

/**
 * Cancela um link (status -> 'cancelled') por id. Apenas links com status
 * 'pending' podem ser cancelados manualmente — links 'confirmed' devem ser
 * cancelados via cancelamento do pedido em /orders (que propaga para o link)
 * e links já 'cancelled' são no-op (idempotente).
 */
export async function cancelOrderLink(id: string): Promise<OrderLink> {
  let client
  try {
    client = await pool.connect()
    const existing = await client.query(
      `SELECT * FROM order_links WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      throw new Error("Link não encontrado")
    }
    const link = existing.rows[0] as OrderLink
    if (link.status === "cancelled") return link
    if (link.status === "confirmed") {
      throw new Error(
        "Este link já foi confirmado. Cancele o pedido relacionado em 'Pedidos' para reverter."
      )
    }
    const result = await client.query(
      `UPDATE order_links
          SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      RETURNING *`,
      [id]
    )
    return result.rows[0] as OrderLink
  } catch (error) {
    console.error("Erro ao cancelar link:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export type GetOrderLinksFilteredOptions = {
  statuses?: OrderLinkStatus[]
  periodFrom?: string
  periodTo?: string
  /** Campo de data: 'created' (created_at) ou 'confirmed' (confirmed_at). Default: 'created'. */
  periodField?: "created" | "confirmed"
  search?: string
  page: number
  pageSize: number
}

export type GetOrderLinksFilteredResult = {
  links: OrderLink[]
  total: number
}

export async function getOrderLinksFiltered(
  options: GetOrderLinksFilteredOptions
): Promise<GetOrderLinksFilteredResult> {
  const { statuses, periodFrom, periodTo, periodField = "created", search, page, pageSize } = options
  let client
  try {
    client = await pool.connect()

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (statuses && statuses.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`)
      params.push(statuses)
      paramIndex++
    }

    if (periodFrom || periodTo) {
      const dateExpr = periodField === "confirmed" ? "confirmed_at" : "created_at"
      if (periodField === "confirmed") {
        conditions.push(`confirmed_at IS NOT NULL`)
      }
      if (periodFrom) {
        conditions.push(`DATE(${dateExpr}) >= $${paramIndex}`)
        params.push(periodFrom)
        paramIndex++
      }
      if (periodTo) {
        conditions.push(`DATE(${dateExpr}) <= $${paramIndex}`)
        params.push(periodTo)
        paramIndex++
      }
    }

    if (search && search.trim()) {
      conditions.push(`(customer_name ILIKE $${paramIndex} OR order_number ILIKE $${paramIndex})`)
      params.push(`%${search.trim()}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const countResult = await client.query(
      `SELECT COUNT(*) FROM order_links ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const offset = (page - 1) * pageSize
    const limitParam = `$${paramIndex}`
    const offsetParam = `$${paramIndex + 1}`
    const queryParams = [...params, pageSize, offset]

    const result = await client.query(
      `SELECT * FROM order_links ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      queryParams
    )
    return { links: result.rows as OrderLink[], total }
  } catch (error) {
    console.error("Erro ao buscar links filtrados:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// --- App Settings (key/value) ---

export async function getAppSetting(key: string): Promise<string | null> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT value FROM app_settings WHERE key = $1`,
      [key]
    )
    if (result.rows.length === 0) return null
    return (result.rows[0].value as string | null) ?? null
  } catch (error) {
    console.error("Erro ao buscar configuração:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

export async function upsertAppSetting(key: string, value: string): Promise<void> {
  let client
  try {
    client = await pool.connect()
    await client.query(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    )
  } catch (error) {
    console.error("Erro ao salvar configuração:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

/**
 * Lê uma configuração booleana de `app_settings`. Quando a chave não existe ou
 * o valor é nulo/inválido, devolve `defaultValue`. Útil para flags cujo valor
 * padrão precisa ser preservado mesmo sem migração explícita.
 */
export async function getAppSettingBoolean(
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  try {
    const value = await getAppSetting(key)
    if (value === null || value === undefined) return defaultValue
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
    return defaultValue
  } catch (error) {
    console.error(`Erro ao ler configuração booleana '${key}':`, error)
    return defaultValue
  }
}

// --- Pedidos por nome de cliente (listagem pública) ---

export type PublicOrderSummary = {
  id: string
  order: string
  quantity_purchased: number
  selected_images: string[]
  created_at: string
  customer_name: string
}

export async function getOrdersByCustomerName(name: string): Promise<PublicOrderSummary[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT id, "order", quantity_purchased, selected_images, created_at, customer_name
         FROM orders
        WHERE LOWER(customer_name) = LOWER($1)
          AND canceled_at IS NULL
        ORDER BY created_at DESC`,
      [name]
    )
    return result.rows.map((row) => ({
      id: row.id,
      order: row.order,
      quantity_purchased: row.quantity_purchased,
      selected_images: row.selected_images,
      created_at: row.created_at,
      customer_name: row.customer_name,
    }))
  } catch (error) {
    console.error("Erro ao buscar pedidos por cliente:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

// --- Criação de pedido em transação com confirmação do link ---

export type CreateOrderResult = {
  order: Order
  link: OrderLink | null
}

/**
 * Cria o pedido e marca o link como 'confirmed' na mesma transação,
 * validando consistência entre customer_name/quantity informados e o link registrado.
 *
 * Comportamento de compatibilidade legacy:
 *  - Se NÃO existir link registrado, ainda permite criar o pedido (mantém comportamento histórico).
 *  - Se existir link 'pending': valida customer_name/quantity, atualiza para 'confirmed' e ata order_id.
 *  - Se existir link 'confirmed': lança erro "Pedido já foi confirmado".
 *
 * Quando `options.autoRegister` é fornecido e NÃO existe link prévio, registra
 * automaticamente um `order_links` com status `confirmed` dentro da mesma
 * transação. Em caso de race (UNIQUE em order_number), o INSERT é no-op e o
 * pedido é criado normalmente sem link associado.
 */
export async function createOrderWithLinkConfirmation(
  order: CreateOrder,
  options?: { autoRegister?: { generatedUrl: string } | null }
): Promise<CreateOrderResult> {
  let client
  try {
    if (!Number.isInteger(order.quantity_purchased) || order.quantity_purchased <= 0) {
      throw new Error("Quantidade do pedido inválida")
    }
    if (
      !Array.isArray(order.selected_images) ||
      order.selected_images.some((item) => typeof item !== "string" || !item.trim())
    ) {
      throw new Error("Itens selecionados inválidos")
    }
    if (order.selected_images.length !== order.quantity_purchased) {
      throw new Error("A quantidade de itens selecionados deve ser igual à quantidade do pedido")
    }
    if (!order.customer_name?.trim()) {
      throw new Error("Nome do cliente é obrigatório")
    }
    if (!order.order?.trim()) {
      throw new Error("Número do pedido é obrigatório")
    }

    client = await pool.connect()
    await client.query("BEGIN")

    const linkResult = await client.query(
      `SELECT * FROM order_links WHERE order_number = $1 FOR UPDATE`,
      [order.order]
    )
    const existingLink = (linkResult.rows[0] ?? null) as OrderLink | null

    if (existingLink) {
      if (existingLink.status === "confirmed") {
        throw new Error("Este pedido já foi confirmado e não pode ser refeito")
      }
      if (existingLink.status === "cancelled") {
        throw new Error("Este link foi cancelado e não pode ser utilizado")
      }
      if (existingLink.customer_name.trim().toLowerCase() !== order.customer_name.trim().toLowerCase()) {
        throw new Error("Os dados do pedido não conferem com o link registrado")
      }
      if (existingLink.quantity !== order.quantity_purchased) {
        throw new Error("A quantidade do pedido não confere com o link registrado")
      }
    }

    // Verifica se já existe um pedido com o mesmo número (UNIQUE em orders.order)
    const orderExists = await client.query(
      'SELECT 1 FROM orders WHERE "order" = $1',
      [order.order]
    )
    if (orderExists.rows.length > 0) {
      throw new Error("Já existe um pedido com este número")
    }

    const insertResult = await client.query(
      `INSERT INTO orders (customer_name, quantity_purchased, selected_images, whatsapp_message, "order")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        order.customer_name,
        order.quantity_purchased,
        JSON.stringify(order.selected_images),
        order.whatsapp_message,
        order.order,
      ]
    )
    const createdOrder = {
      ...insertResult.rows[0],
      selected_images: insertResult.rows[0].selected_images,
    } as Order

    let updatedLink: OrderLink | null = null
    if (existingLink) {
      const updateResult = await client.query(
        `UPDATE order_links
            SET status = 'confirmed',
                confirmed_at = NOW(),
                updated_at = NOW(),
                order_id = $2
          WHERE id = $1
        RETURNING *`,
        [existingLink.id, createdOrder.id]
      )
      updatedLink = updateResult.rows[0] as OrderLink
    } else if (options?.autoRegister) {
      // Auto-registro: cria order_link já confirmado para pedidos vindos de
      // links não cadastrados quando o admin habilitou esse modo.
      // ON CONFLICT DO NOTHING evita duplicidade em condições de corrida.
      const autoRegisterResult = await client.query(
        `INSERT INTO order_links
           (customer_name, order_number, quantity, message, message_template,
            generated_url, status, confirmed_at, order_id)
         VALUES ($1, $2, $3, NULL, NULL, $4, 'confirmed', NOW(), $5)
         ON CONFLICT (order_number) DO NOTHING
         RETURNING *`,
        [
          order.customer_name,
          order.order,
          order.quantity_purchased,
          options.autoRegister.generatedUrl,
          createdOrder.id,
        ]
      )
      updatedLink = (autoRegisterResult.rows[0] ?? null) as OrderLink | null
    }

    await client.query("COMMIT")
    return { order: createdOrder, link: updatedLink }
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK")
      } catch (rollbackError) {
        console.error("Erro ao executar ROLLBACK:", rollbackError)
      }
    }
    console.error("Erro ao criar pedido com confirmação de link:", error)
    throw error
  } finally {
    if (client) client.release()
  }
}

