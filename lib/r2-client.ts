import { S3Client } from "@aws-sdk/client-s3"

/**
 * Cria um S3Client configurado para o Cloudflare R2 a partir das variáveis de
 * ambiente. Lança erro descritivo quando faltam credenciais. Compartilhado
 * entre as rotas que precisam falar com o R2 (ex.: modal promocional).
 */
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  const missing: string[] = []
  if (!accountId) missing.push("R2_ACCOUNT_ID")
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID")
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY")
  if (missing.length > 0) {
    throw new Error(`Credenciais R2 não configuradas: ${missing.join(", ")}`)
  }

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
    },
  })
}

export function getR2BucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME não configurado")
  }
  return bucketName
}
