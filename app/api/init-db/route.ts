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
        expires_at TIMESTAMP WITH TIME ZONE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL
      );
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_links_status ON order_links(status);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_links_customer ON order_links(customer_name);`)
    // Migração: coluna expires_at (snapshot do prazo no momento do registro do link)
    try {
      await client.query(`
        ALTER TABLE order_links
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
      `)
      console.log("API: Migração de campo expires_at em order_links aplicada com sucesso")
    } catch (error) {
      console.log("API: Campo expires_at já existe ou erro na migração:", error)
    }
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
        "Olá! Aqui está o link para escolher os itens do seu pedido na nossa galeria: {{link}}",
      ]
    )
    console.log("API: Tabela app_settings criada/verificada (com seed default_link_message)")

    // Seed custos de produção (dashboard) — não sobrescreve valores já salvos
    await client.query(`
      INSERT INTO app_settings(key, value) VALUES
        ('cost_cut_sew_per_item', '0'),
        ('cost_fabric_per_meter', '0'),
        ('cost_packaging_per_order', '0')
      ON CONFLICT (key) DO NOTHING;
    `)
    console.log("API: Seed de custos de produção (app_settings) verificado")

    // Tabela measurements: metragem por quantidade (usada em listas e dashboard)
    await client.query(`
      CREATE TABLE IF NOT EXISTS measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quantity INTEGER NOT NULL,
        meters NUMERIC(10, 2) NOT NULL CHECK (meters >= 0),
        observation TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT measurements_quantity_unique UNIQUE (quantity),
        CONSTRAINT measurements_quantity_positive CHECK (quantity > 0)
      );
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_measurements_quantity ON measurements (quantity);`)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_finalized_at
        ON orders (finalized_at)
        WHERE finalized_at IS NOT NULL AND canceled_at IS NULL;
    `)
    await client.query(`
      INSERT INTO measurements (quantity, meters, observation) VALUES
        (2,   0.56, 'DINIZ'),
        (3,   0.56, 'DINIZ'),
        (4,   1.13, 'DINIZ'),
        (5,   1.13, 'DINIZ'),
        (6,   1.13, 'DINIZ'),
        (7,   1.69, 'DINIZ'),
        (8,   1.69, 'DINIZ'),
        (9,   1.69, 'DINIZ'),
        (10,  2.26, 'DINIZ'),
        (11,  2.26, 'DINIZ'),
        (12,  2.26, 'DINIZ'),
        (13,  2.82, 'DINIZ'),
        (15,  2.82, 'DINIZ'),
        (16,  3.39, 'DINIZ'),
        (17,  3.37, 'DINIZ'),
        (18,  3.39, 'DINIZ'),
        (20,  3.95, 'DINIZ'),
        (21,  3.95, 'DINIZ'),
        (22,  4.52, 'DINIZ'),
        (24,  4.52, 'DINIZ'),
        (26,  4.79, 'DINIZ'),
        (27,  5.09, 'DINIZ'),
        (28,  5.55, 'DINIZ'),
        (29,  5.65, 'DINIZ'),
        (30,  5.65, 'DINIZ'),
        (32,  6.10, 'DINIZ'),
        (35,  6.71, 'DINIZ'),
        (36,  6.77, 'DINIZ'),
        (39,  7.34, 'DINIZ'),
        (40,  7.76, 'DINIZ'),
        (42,  7.90, 'DINIZ'),
        (45,  9.30, 'DINIZ'),
        (48,  9.30, 'DINIZ'),
        (51,  9.60, 'DINIZ'),
        (60, 11.30, 'DINIZ'),
        (69, 13.00, 'DINIZ'),
        (72, 13.54, 'DINIZ'),
        (84, 15.80, 'DINIZ'),
        (120, 22.60, 'DINIZ')
      ON CONFLICT (quantity) DO NOTHING;
    `)
    console.log("API: Tabela measurements criada/verificada (com seed)")

    // Tabela promo_modals: modal promocional exibido nas páginas /confirmed e /orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_modals (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        title_html TEXT NOT NULL DEFAULT '',
        description_html TEXT NOT NULL DEFAULT '',
        title_align TEXT NOT NULL DEFAULT 'center',
        title_color TEXT NOT NULL DEFAULT '#111827',
        title_size TEXT NOT NULL DEFAULT '24',
        title_bold BOOLEAN NOT NULL DEFAULT true,
        desc_align TEXT NOT NULL DEFAULT 'center',
        desc_color TEXT NOT NULL DEFAULT '#374151',
        desc_size TEXT NOT NULL DEFAULT '16',
        desc_bold BOOLEAN NOT NULL DEFAULT false,
        background_color TEXT NOT NULL DEFAULT '#ffffff',
        button_text TEXT NOT NULL DEFAULT '',
        button_url TEXT NOT NULL DEFAULT '',
        button_bg_color TEXT NOT NULL DEFAULT '#4f46e5',
        button_text_color TEXT NOT NULL DEFAULT '#ffffff',
        open_delay_seconds INTEGER NOT NULL DEFAULT 3,
        max_displays INTEGER NOT NULL DEFAULT 1,
        active BOOLEAN NOT NULL DEFAULT false,
        click_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_modals_single_active
       ON promo_modals(active) WHERE active = true;`
    )
    console.log("API: Tabela promo_modals criada/verificada")

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
