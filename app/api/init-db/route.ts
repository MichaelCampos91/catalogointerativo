import { NextResponse } from "next/server"
import { Pool } from "pg"

export async function POST() {
  let client

  // Verificar se as variáveis de ambiente estão definidas
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    return NextResponse.json(
      {
        status: "error",
        message: "Variáveis de ambiente do banco de dados não estão definidas",
        config: {
          DB_HOST: process.env.DB_HOST ? "✅ Definido" : "❌ Não definido",
          DB_NAME: process.env.DB_NAME ? "✅ Definido" : "❌ Não definido",
          DB_USER: process.env.DB_USER ? "✅ Definido" : "❌ Não definido",
          DB_PASSWORD: process.env.DB_PASSWORD ? "✅ Definido" : "❌ Não definido",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }

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
  })

  try {
    console.log("API: Iniciando criação das tabelas...")
    client = await pool.connect()

    // Criar tabelas se não existirem
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog_images (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        customer_name TEXT NOT NULL,
        quantity_purchased INTEGER NOT NULL,
        selected_images JSONB NOT NULL,
        whatsapp_message TEXT,
        "order" TEXT NOT NULL UNIQUE,
        is_pending BOOLEAN DEFAULT true,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        in_production BOOLEAN DEFAULT false,
        in_production_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    // Migração: Adicionar campos in_production e in_production_at se não existirem
    try {
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS in_production BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS in_production_at TIMESTAMP WITH TIME ZONE;
      `)
      console.log("API: Migração de campos in_production aplicada com sucesso")
    } catch (error) {
      console.log("API: Campos in_production já existem ou erro na migração:", error)
    }

    // Migração: Adicionar campo finalized_at se não existir
    try {
      await client.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
      `)
      console.log("API: Migração de campo finalized_at aplicada com sucesso")
    } catch (error) {
      console.log("API: Campo finalized_at já existe ou erro na migração:", error)
    }

    // Migração: Adicionar campo canceled_at se não existir
    try {
      await client.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;
      `)
      console.log("API: Migração de campo canceled_at aplicada com sucesso")
    } catch (error) {
      console.log("API: Campo canceled_at já existe ou erro na migração:", error)
    }

    // Tabelas para Histórico de Produção (lotes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS production_batches (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS production_batch_orders (
        batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        PRIMARY KEY (batch_id, order_id)
      );
    `)
    console.log("API: Tabelas production_batches e production_batch_orders criadas/verificadas")

    // Tabela order_links: registro de links gerados pelo admin (controle de acesso ao modo pedido)
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_links (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        customer_name TEXT NOT NULL,
        order_number TEXT NOT NULL UNIQUE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        message TEXT,
        message_template TEXT,
        generated_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        confirmed_at TIMESTAMP WITH TIME ZONE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL
      );
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_links_status ON order_links(status);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_links_customer ON order_links(customer_name);`)
    console.log("API: Tabela order_links criada/verificada")

    // Tabela app_settings: configurações simples chave/valor (ex.: template padrão da mensagem)
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)
    await client.query(
      `INSERT INTO app_settings(key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [
        "default_link_message",
        "Olá! Aqui está o link para escolher os itens do seu pedido na nossa galeria: {{link gerado}}",
      ]
    )
    console.log("API: Tabela app_settings criada/verificada (com seed default_link_message)")

    // Inserir dados de exemplo apenas se não existirem
    const categoriesCount = await client.query("SELECT COUNT(*) FROM categories")
    if (Number.parseInt(categoriesCount.rows[0].count) === 0) {
      console.log("API: Inserindo categorias de exemplo...")
      await client.query(`
        INSERT INTO categories (name, slug) VALUES
        ('Aquarela', 'aquarela'),
        ('Bebê', 'bebe'),
        ('Festa', 'festa'),
        ('Natureza', 'natureza'),
        ('Abstrato', 'abstrato');
      `)
    }

    const imagesCount = await client.query("SELECT COUNT(*) FROM catalog_images")
    if (Number.parseInt(imagesCount.rows[0].count) === 0) {
      console.log("API: Inserindo imagens de exemplo...")
      await client.query(`
        INSERT INTO catalog_images (code, category_id, image_url, thumbnail_url)
        SELECT v.code, c.id, v.image_url, v.thumbnail_url
        FROM (VALUES
          ('AA-001', 'aquarela', '/placeholder.svg?height=400&width=400&text=Aquarela+1', '/placeholder.svg?height=200&width=200&text=AA-001'),
          ('AA-002', 'aquarela', '/placeholder.svg?height=400&width=400&text=Aquarela+2', '/placeholder.svg?height=200&width=200&text=AA-002'),
          ('AA-003', 'aquarela', '/placeholder.svg?height=400&width=400&text=Aquarela+3', '/placeholder.svg?height=200&width=200&text=AA-003'),
          ('BB-001', 'bebe', '/placeholder.svg?height=400&width=400&text=Bebe+1', '/placeholder.svg?height=200&width=200&text=BB-001'),
          ('BB-002', 'bebe', '/placeholder.svg?height=400&width=400&text=Bebe+2', '/placeholder.svg?height=200&width=200&text=BB-002'),
          ('BB-003', 'bebe', '/placeholder.svg?height=400&width=400&text=Bebe+3', '/placeholder.svg?height=200&width=200&text=BB-003'),
          ('FF-001', 'festa', '/placeholder.svg?height=400&width=400&text=Festa+1', '/placeholder.svg?height=200&width=200&text=FF-001'),
          ('FF-002', 'festa', '/placeholder.svg?height=400&width=400&text=Festa+2', '/placeholder.svg?height=200&width=200&text=FF-002'),
          ('NN-001', 'natureza', '/placeholder.svg?height=400&width=400&text=Natureza+1', '/placeholder.svg?height=200&width=200&text=NN-001'),
          ('NN-002', 'natureza', '/placeholder.svg?height=400&width=400&text=Natureza+2', '/placeholder.svg?height=200&width=200&text=NN-002'),
          ('AB-001', 'abstrato', '/placeholder.svg?height=400&width=400&text=Abstrato+1', '/placeholder.svg?height=200&width=200&text=AB-001'),
          ('AB-002', 'abstrato', '/placeholder.svg?height=400&width=400&text=Abstrato+2', '/placeholder.svg?height=200&width=200&text=AB-002')
        ) AS v(code, category_slug, image_url, thumbnail_url)
        JOIN categories c ON c.slug = v.category_slug;
      `)
    }

    // Verificar dados inseridos
    const finalCategoriesCount = await client.query("SELECT COUNT(*) FROM categories")
    const finalImagesCount = await client.query("SELECT COUNT(*) FROM catalog_images")

    console.log("API: Banco inicializado com sucesso")
    return NextResponse.json({
      status: "success",
      message: "Banco de dados inicializado com sucesso!",
      data: {
        categories: Number.parseInt(finalCategoriesCount.rows[0].count),
        images: Number.parseInt(finalImagesCount.rows[0].count),
      },
      config: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("API: Erro ao inicializar banco:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao inicializar banco de dados",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        config: {
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  } finally {
    if (client) client.release()
    await pool.end()
  }
}
