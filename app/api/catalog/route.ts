import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

interface ImageItem {
  path: string
  name: string
  category: string
}

// Função para ler diretório recursivamente
async function readDirectoryRecursively(dirPath: string, basePath: string): Promise<ImageItem[]> {
  const items = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const results: ImageItem[] = []

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    
    if (item.isDirectory()) {
      const subResults = await readDirectoryRecursively(fullPath, basePath)
      results.push(...subResults)
    } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)) {
      // Calcular o caminho relativo corretamente
      const relativePath = path.relative(basePath, fullPath)
      const category = path.dirname(relativePath)
      
      results.push({
        path: relativePath,
        name: item.name,
        category: category === '.' ? 'root' : category
      })
    }
  }

  return results
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const category = searchParams.get('category')

    const basePath = path.join(process.cwd(), "public", "files")
    const baseUrlPath = process.env.NEXT_PUBLIC_BASE_PATH || ""
    
    // Verificar se o diretório existe
    if (!fs.existsSync(basePath)) {
      return NextResponse.json({ error: "Diretório não encontrado" }, { status: 404 })
    }

    // Ler todas as imagens recursivamente
    const allImages = await readDirectoryRecursively(basePath, basePath)
    
    // Agrupar por categoria
    const categoriesMap = new Map()
    allImages.forEach((img: ImageItem) => {
      if (!categoriesMap.has(img.category)) {
        categoriesMap.set(img.category, {
          id: `cat_${categoriesMap.size + 1}`,
          name: img.category === 'root' ? 'Geral' : img.category,
          slug: img.category.toLowerCase().replace(/\s+/g, '-')
        })
      }
    })

    const categories = Array.from(categoriesMap.values())

    // Filtrar por categoria se especificado
    let filteredImages = allImages
    if (category) {
      filteredImages = allImages.filter((img: ImageItem) => img.category === category)
    }

    // Aplicar paginação
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedImages = filteredImages.slice(startIndex, endIndex)

    // Transformar imagens no formato esperado
    const images = paginatedImages.map((img: ImageItem, index: number) => ({
      id: `img_${index + 1}`,
      code: path.parse(img.name).name,
      category_id: categoriesMap.get(img.category).id,
      image_url: `${baseUrlPath}/files/${img.path}`,
      thumbnail_url: `${baseUrlPath}/files/${img.path}`
    }))

    return NextResponse.json({
      categories,
      images,
      pagination: {
        total: filteredImages.length,
        page,
        limit,
        totalPages: Math.ceil(filteredImages.length / limit)
      }
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