import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import { randomUUID } from "crypto"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import { getR2Client, getR2BucketName } from "@/lib/r2-client"

const PROMO_PREFIX = "public/promo/"

/**
 * Upload de imagem usada no conteúdo do modal promocional.
 * Processa com sharp (redimensiona/comprime), grava no R2 sob public/promo/ e
 * retorna uma URL ESTÁVEL apontando para o proxy público (/api/promo-modal/image),
 * evitando que a signed URL de 24h quebre a imagem embutida no conteúdo.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    return authErrorResponse(err instanceof Error ? err.message : "Token não fornecido", 401)
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "Arquivo não especificado" }, { status: 400 })
    }

    const isImage = file.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
    if (!isImage) {
      return NextResponse.json({ error: "O arquivo deve ser uma imagem" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    let buffer: Buffer = Buffer.from(bytes)
    let contentType = "image/jpeg"
    let ext = "jpg"

    try {
      const image = sharp(buffer)
      const metadata = await image.metadata()
      let processed = image
      if (metadata.width && metadata.width > 1600) {
        processed = processed.resize(1600, null, { withoutEnlargement: true, fit: "inside" })
      }
      if (metadata.format === "png") {
        buffer = Buffer.from(await processed.png({ compressionLevel: 9 }).toBuffer())
        contentType = "image/png"
        ext = "png"
      } else if (metadata.format === "webp") {
        buffer = Buffer.from(await processed.webp({ quality: 82 }).toBuffer())
        contentType = "image/webp"
        ext = "webp"
      } else {
        buffer = Buffer.from(await processed.jpeg({ quality: 82 }).toBuffer())
        contentType = "image/jpeg"
        ext = "jpg"
      }
    } catch (imageError) {
      console.error("API: Erro ao processar imagem do modal, usando original:", imageError)
      buffer = Buffer.from(bytes)
    }

    const key = `${PROMO_PREFIX}${randomUUID()}.${ext}`
    const s3Client = getR2Client()
    const bucketName = getR2BucketName()

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )

    const url = `/api/promo-modal/image?key=${encodeURIComponent(key)}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error("API: Erro no upload de imagem do modal:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isConfig = /R2|Credenciais|configurado/i.test(message)
    return NextResponse.json(
      { error: isConfig ? "Erro de configuração do armazenamento (R2)" : "Erro ao enviar imagem", message },
      { status: 500 }
    )
  }
}
