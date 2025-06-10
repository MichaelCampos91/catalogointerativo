import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import archiver from "archiver"

export async function POST(request: Request) {
  try {
    const { selectedImages, customerName, orderNumber, date } = await request.json()
    
    // Criar pasta temporária para os arquivos
    const tempDir = path.join(process.cwd(), "public", "temp")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }

    // Criar pasta do pedido
    const orderDate = new Date(date).toISOString().split('T')[0]
    const folderName = `${orderDate}_${customerName}_${orderNumber}`
    const orderDir = path.join(tempDir, folderName)
    fs.mkdirSync(orderDir, { recursive: true })

    // Buscar arquivos em /public/files
    const filesDir = path.join(process.cwd(), "public", "files")
    const foundFiles: string[] = []

    // Função recursiva para buscar arquivos
    function findFiles(dir: string) {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name)
        
        if (item.isDirectory()) {
          findFiles(fullPath)
        } else {
          const fileName = path.parse(item.name).name
          if (selectedImages.includes(fileName)) {
            // Copiar arquivo diretamente para a pasta do pedido
            const destPath = path.join(orderDir, item.name)
            fs.copyFileSync(fullPath, destPath)
            foundFiles.push(destPath)
          }
        }
      }
    }

    findFiles(filesDir)

    // Criar arquivo ZIP
    const zipPath = path.join(tempDir, `${folderName}.zip`)
    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", {
      zlib: { level: 9 }
    })

    archive.pipe(output)
    archive.directory(orderDir, false)
    await archive.finalize()

    // Limpar pasta temporária
    fs.rmSync(orderDir, { recursive: true, force: true })

    return NextResponse.json({
      success: true,
      zipPath: `/temp/${folderName}.zip`,
      foundFiles: foundFiles.length
    })
  } catch (error) {
    console.error("Erro ao preparar download:", error)
    return NextResponse.json(
      {
        error: "Erro ao preparar download",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
} 