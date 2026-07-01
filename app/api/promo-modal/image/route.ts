import { NextResponse } from "next/server"
import { getR2Client, getR2BucketName } from "@/lib/r2-client"
import { getSignedUrlForR2 } from "@/lib/r2-cache"

const PROMO_PREFIX = "public/promo/"

/**
 * Proxy público estável para imagens do modal promocional. Recebe a `key` do
 * objeto no R2 e redireciona (302) para uma signed URL fresca. Como as signed
 * URLs expiram (24h), este endpoint garante URLs sempre válidas para imagens
 * embutidas no conteúdo. Restrito ao prefixo public/promo/ por segurança.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key") || ""

    if (!key || !key.startsWith(PROMO_PREFIX) || key.includes("..")) {
      return NextResponse.json({ error: "Chave inválida" }, { status: 400 })
    }

    const s3Client = getR2Client()
    const bucketName = getR2BucketName()
    const signedUrl = await getSignedUrlForR2(s3Client, bucketName, key)

    return NextResponse.redirect(signedUrl, 302)
  } catch (error) {
    console.error("API: Erro ao servir imagem do modal:", error)
    return NextResponse.json({ error: "Erro ao carregar imagem" }, { status: 500 })
  }
}
