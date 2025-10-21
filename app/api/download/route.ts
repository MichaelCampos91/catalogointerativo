import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import archiver from "archiver"
import { Storage } from '@google-cloud/storage'

// Função para inicializar o Google Cloud Storage
function getStorage() {
  const isCloudRun = process.env.K_SERVICE || process.env.K_REVISION || process.env.PORT
  if (isCloudRun) {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
    })
  }
  if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY && process.env.GCS_PRIVATE_KEY.trim() !== '') {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    })
  }
  return new Storage({
    projectId: process.env.GCS_PROJECT_ID,
  })
}

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

    // Buscar e baixar arquivos do GCS
    const storage = getStorage()
    const bucketName = process.env.GCS_BUCKET_NAME
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME não configurado")
    }
    
    const bucket = storage.bucket(bucketName)
    const foundFiles: string[] = []

    // Listar todos os arquivos do bucket com prefixo public/files/
    const [files] = await bucket.getFiles({ prefix: 'public/files/' })

    // Filtrar e baixar apenas os arquivos selecionados
    for (const file of files) {
      const fileName = path.parse(file.name).name
      if (selectedImages.includes(fileName)) {
        const destPath = path.join(orderDir, path.basename(file.name))
        await file.download({ destination: destPath })
        foundFiles.push(destPath)
      }
    }

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

    // Incluir o caminho base correto
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

    return NextResponse.json({
      success: true,
      zipPath: `${basePath}/temp/${folderName}.zip`,
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