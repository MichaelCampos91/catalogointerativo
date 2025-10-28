import { NextResponse } from "next/server"
import path from "path"
import archiver from "archiver"
import { PassThrough } from "stream"
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

    // Preparar nome seguro do arquivo final
    const orderDate = new Date(date).toISOString().split('T')[0]
    const sanitize = (s: string) => String(s || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\.{2,}/g, "")
      .replace(/[\/\\]+/g, "_")
      .replace(/[^\w\- \.]+/g, "")
      .trim()
      .slice(0, 80)
    const folderName = `${orderDate}_${sanitize(customerName)}_${sanitize(orderNumber)}`

    // Buscar e baixar arquivos do GCS
    const storage = getStorage()
    const bucketName = process.env.GCS_BUCKET_NAME
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME não configurado")
    }
    
    const bucket = storage.bucket(bucketName)

    // Listar todos os arquivos do bucket com prefixo public/files/
    const [files] = await bucket.getFiles({ prefix: 'public/files/' })

    // Filtrar apenas os arquivos selecionados por código (basename sem extensão)
    const wanted = new Set<string>(selectedImages || [])
    const matches = files.filter((file) => wanted.has(path.parse(file.name).name))

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo encontrado', message: 'Não foi possível localizar os arquivos solicitados' },
        { status: 404 }
      )
    }

    // Criar ZIP em streaming diretamente para a resposta
    const archive = archiver('zip', { zlib: { level: 9 } })
    const pass = new PassThrough()
    archive.pipe(pass)

    // Adicionar arquivos do GCS diretamente ao ZIP (sem subpastas) com resolução de nomes duplicados
    const usedNames = new Map<string, number>()
    const getUniqueName = (baseName: string) => {
      if (!usedNames.has(baseName)) {
        usedNames.set(baseName, 1)
        return baseName
      }
      const count = (usedNames.get(baseName) || 1) + 1
      usedNames.set(baseName, count)
      const ext = path.extname(baseName)
      const nameOnly = baseName.slice(0, baseName.length - ext.length)
      return `${nameOnly} (${count})${ext}`
    }

    for (const file of matches) {
      const flatName = path.basename(file.name) // remove subpastas, mantém extensão
      const entryName = getUniqueName(flatName)
      archive.append(file.createReadStream(), { name: entryName })
    }

    // Finalizar o ZIP (começa a ser enviado conforme é gerado)
    archive.finalize()

    return new NextResponse(pass as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Cache-Control': 'no-store',
      },
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