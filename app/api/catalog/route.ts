import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const basePath = path.join(process.cwd(), "public", "files")
    
    // Verificar se o diretório existe
    if (!fs.existsSync(basePath)) {
      return NextResponse.json({ error: "Diretório não encontrado" }, { status: 404 })
    }

    // Ler o conteúdo do diretório
    const items = fs.readdirSync(basePath, { withFileTypes: true })
    
    // Filtrar apenas diretórios (categorias)
    const categories = items
      .filter(item => item.isDirectory())
      .map((dir, index) => ({
        id: `cat_${index + 1}`,
        name: dir.name,
        slug: dir.name.toLowerCase().replace(/\s+/g, '-')
      }))

    // Para cada categoria, buscar as imagens
    const images = []
    for (const category of categories) {
      const categoryPath = path.join(basePath, category.name)
      const categoryItems = fs.readdirSync(categoryPath, { withFileTypes: true })
      
      // Filtrar apenas arquivos de imagem
      const categoryImages = categoryItems
        .filter(item => !item.isDirectory() && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name))
        .map((file, index) => ({
          id: `img_${category.id}_${index + 1}`,
          code: path.parse(file.name).name, // Nome do arquivo sem extensão
          category_id: category.id,
          image_url: `/files/${category.name}/${file.name}`,
          thumbnail_url: `/files/${category.name}/${file.name}`
        }))

      images.push(...categoryImages)
    }

    return NextResponse.json({
      categories,
      images
    })
  } catch (error) {
    console.error("Erro ao carregar catálogo:", error)
    return NextResponse.json(
      {
        error: "Erro ao carregar catálogo",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
} 