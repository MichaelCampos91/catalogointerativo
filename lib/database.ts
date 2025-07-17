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
}

export type CreateOrder = {
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  whatsapp_message: string | null
  order: string
}

// Funções para pedidos
export async function getOrders(): Promise<Order[]> {
  let client
  try {
    client = await pool.connect()
    const result = await client.query("SELECT * FROM orders ORDER BY created_at ASC")
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

// Função para criar um novo pedido
export async function createOrder(order: CreateOrder): Promise<Order> {
  let client
  try {
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

