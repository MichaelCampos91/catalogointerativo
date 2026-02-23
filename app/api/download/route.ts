import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import path from "path"
import archiver from "archiver"
import { PassThrough } from "stream"
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth, authErrorResponse } from "@/lib/auth"

// Função para inicializar o S3Client para Cloudflare R2
function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Credenciais R2 não configuradas")
  }

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  })
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }
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

    // Buscar e baixar arquivos do R2
    const s3Client = getS3Client()
    const bucketName = process.env.R2_BUCKET_NAME
    if (!bucketName) {
      throw new Error("R2_BUCKET_NAME não configurado")
    }

    // Listar arquivos do bucket com prefixo public/files/ e limite de 5000
    const allObjects: Array<{ Key: string }> = []
    let continuationToken: string | undefined = undefined
    const maxResults = 5000

    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'public/files/',
        MaxKeys: maxResults,
        ContinuationToken: continuationToken,
      })

      const response = await s3Client.send(command)
      
      if (response.Contents) {
        allObjects.push(...response.Contents.map((obj: { Key?: string }) => ({ Key: obj.Key! })))
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken && allObjects.length < maxResults)

    // Verificar se pode ter mais arquivos além do limite
    if (allObjects.length === maxResults) {
      console.warn('⚠️ Limite de 5000 arquivos atingido na listagem. Alguns arquivos podem não estar disponíveis.')
    }

    // Filtrar apenas os arquivos selecionados por código (basename sem extensão)
    const wanted = new Set<string>(selectedImages || [])
    const matches = allObjects.filter((obj) => {
      const fileName = path.basename(obj.Key)
      const code = path.parse(fileName).name
      return wanted.has(code)
    })

    if (matches.length === 0) {
      return NextResponse.json(
        { 
          error: 'Nenhum arquivo encontrado', 
          message: 'Não foi possível localizar os arquivos solicitados. Verifique se os códigos estão corretos ou se o limite de 5000 arquivos foi atingido.' 
        },
        { status: 404 }
      )
    }
    
    // Verificar se todos os arquivos solicitados foram encontrados
    if (matches.length < wanted.size) {
      const foundCodes = new Set(matches.map(obj => path.parse(path.basename(obj.Key)).name))
      const missing = Array.from(wanted).filter(code => !foundCodes.has(code))
      console.warn('⚠️ Alguns arquivos não foram encontrados:', missing)
    }

    // Criar ZIP em streaming diretamente para a resposta
    const archive = archiver('zip', { zlib: { level: 9 } })
    const pass = new PassThrough()
    archive.pipe(pass)

    // Adicionar arquivos do R2 diretamente ao ZIP (sem subpastas) ignorando duplicatas
    const usedNames = new Set<string>()
    const warnings: string[] = []

    // Processar arquivos e adicionar ao ZIP
    for (const obj of matches) {
      const flatName = path.basename(obj.Key) // remove subpastas, mantém extensão
      if (usedNames.has(flatName)) {
        warnings.push(`⚠️ Existiam 2 arquivos com mesmo nome + ${flatName}. O segundo arquivo foi removido da lista.`)
        continue
      }
      usedNames.add(flatName)
      
      // Obter objeto do R2
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: obj.Key,
      })
      
      const response = await s3Client.send(getCommand)
      
      if (response.Body) {
        // O Body do AWS SDK v3 é um stream nativo do Node.js
        // Converter para Buffer para compatibilidade com archiver
        const stream = response.Body as any
        const chunks: Buffer[] = []
        
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk))
        }
        
        const buffer = Buffer.concat(chunks)
        archive.append(buffer, { name: flatName })
      }
    }

    // Finalizar o ZIP (começa a ser enviado conforme é gerado)
    archive.finalize()

    // Preparar header de aviso somente com caracteres ASCII (usar URL encoding)
    const warningHeaderValue = warnings.length > 0
      ? warnings.map((w) => encodeURIComponent(w)).join(' | ')
      : undefined

    return new NextResponse(pass as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Cache-Control': 'no-store',
        ...(warningHeaderValue ? { 'X-Warning': warningHeaderValue } : {}),
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