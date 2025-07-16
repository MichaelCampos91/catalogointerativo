import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Função utilitária para normalizar códigos (remove espaços, pontos, case-insensitive)
function normalizeCode(str: string) {
  return str.replace(/\s+/g, '').replace(/\.+$/, '').replace(/\.(jpg|jpeg|png|gif|webp)$/i, '').toLowerCase();
}

// Função para encontrar uma imagem pelo código
async function findImageByCode(imageCode: string): Promise<string | null> {
  const basePath = path.join(process.cwd(), "public", "files")
  
  if (!fs.existsSync(basePath)) {
    return null
  }

  const normalizedSearch = normalizeCode(imageCode)

  // 1. Buscar correspondência exata (após normalização)
  let exactMatch: string | null = null
  // 2. Buscar correspondência flexível (ignorar apenas caracteres especiais, mas não substring)
  let flexibleMatch: string | null = null

  // Função recursiva para buscar a imagem
  const searchRecursively = async (dirPath: string): Promise<void> => {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        await searchRecursively(fullPath)
        if (exactMatch) return
      } else if (item.isFile()) {
        const fileName = item.name
        const fileNameWithoutExt = path.parse(item.name).name
        const normalizedFile = normalizeCode(fileNameWithoutExt)
        // 1. Correspondência exata (após normalização)
        if (!exactMatch && normalizedFile === normalizedSearch && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
          exactMatch = path.relative(basePath, fullPath)
          return
        }
        // 2. Correspondência flexível: ignora apenas caracteres especiais, mas não aceita substring pura
        if (!flexibleMatch && !exactMatch) {
          // Remove tudo que não é letra, número ou hífen
          const alnumFile = normalizedFile.replace(/[^\w-]/g, '')
          const alnumSearch = normalizedSearch.replace(/[^\w-]/g, '')
          if (alnumFile === alnumSearch && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
            flexibleMatch = path.relative(basePath, fullPath)
          }
        }
      }
    }
  }

  await searchRecursively(basePath)
  if (exactMatch) return exactMatch
  if (flexibleMatch) return flexibleMatch
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json({ error: "Código da imagem é obrigatório" }, { status: 400 })
    }

    console.log(`Buscando imagem com código: "${code}"`)
    const imagePath = await findImageByCode(code)
    
    if (!imagePath) {
      console.log(`❌ Imagem não encontrada para código: "${code}"`)
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })
    }

    const baseUrlPath = process.env.NEXT_PUBLIC_BASE_PATH || ""
    const imageUrl = `${baseUrlPath}/files/${imagePath}`
    
    console.log(`✅ Imagem encontrada: ${imagePath} -> ${imageUrl}`)
    return NextResponse.json({ url: imageUrl, path: imagePath })
  } catch (error) {
    console.error("Erro ao buscar imagem:", error)
    return NextResponse.json(
      {
        error: "Erro ao buscar imagem",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
} 