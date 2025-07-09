import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Função para encontrar uma imagem pelo código
async function findImageByCode(imageCode: string): Promise<string | null> {
  const basePath = path.join(process.cwd(), "public", "files")
  
  if (!fs.existsSync(basePath)) {
    return null
  }

  // Função recursiva para buscar a imagem
  const searchRecursively = async (dirPath: string): Promise<string | null> => {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      
      if (item.isDirectory()) {
        const result = await searchRecursively(fullPath)
        if (result) return result
      } else if (item.isFile()) {
        const fileName = item.name
        const fileNameWithoutExt = path.parse(item.name).name
        
        // Limpar o código de busca removendo extensão se existir
        const cleanImageCode = imageCode.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
        
        // Tentar diferentes formas de comparação
        const comparisons = [
          fileNameWithoutExt === cleanImageCode, // Comparação exata sem extensão
          fileNameWithoutExt === imageCode, // Comparação com extensão (caso o arquivo tenha extensão no nome)
          fileNameWithoutExt.replace(/\.+$/, '') === cleanImageCode.replace(/\.+$/, ''), // Removendo pontos no final
          fileNameWithoutExt.replace(/\s+/g, '') === cleanImageCode.replace(/\s+/g, ''), // Removendo espaços
          fileNameWithoutExt.replace(/[^\w-]/g, '') === cleanImageCode.replace(/[^\w-]/g, ''), // Apenas letras, números e hífens
          fileName === imageCode, // Comparação exata com extensão
        ]
        
        if (comparisons.some(comp => comp) && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)) {
          console.log(`Match encontrado: arquivo="${fileNameWithoutExt}" código="${imageCode}"`)
          const relativePath = path.relative(basePath, fullPath)
          return relativePath
        }
      }
    }
    
    return null
  }

  return await searchRecursively(basePath)
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
      console.log(`Imagem não encontrada para código: "${code}"`)
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 })
    }

    const baseUrlPath = process.env.NEXT_PUBLIC_BASE_PATH || ""
    const imageUrl = `${baseUrlPath}/files/${imagePath}`
    
    console.log(`Imagem encontrada: ${imagePath}`)
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