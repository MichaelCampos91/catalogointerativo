import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Constantes de configuração
const CACHE_TTL = 15 * 60 * 1000 // 15 minutos
const SIGNED_URL_EXPIRES = 24 * 60 * 60 // 24 horas em segundos
const SIGNED_URL_CACHE_TTL = 23 * 60 * 60 * 1000 // 23 horas (evitar regeneração)

// Estrutura do cache
interface CacheEntry {
  data: any
  timestamp: number
  expiresAt: number
}

interface SignedUrlCacheEntry {
  url: string
  expiresAt: number
}

// Cache em memória para respostas da API
const apiCache = new Map<string, CacheEntry>()

// Cache em memória para signed URLs
const signedUrlCache = new Map<string, SignedUrlCacheEntry>()

/**
 * Limpa entradas expiradas do cache (lazy cleanup)
 */
function cleanupExpiredEntries(cache: Map<string, CacheEntry | SignedUrlCacheEntry>) {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key)
    }
  }
}

/**
 * Obtém dados do cache se ainda válidos
 */
export function getFromCache(key: string): any | null {
  cleanupExpiredEntries(apiCache)
  const entry = apiCache.get(key)
  
  if (!entry) {
    return null
  }
  
  if (Date.now() >= entry.expiresAt) {
    apiCache.delete(key)
    return null
  }
  
  return entry.data
}

/**
 * Armazena dados no cache
 */
export function setCache(key: string, data: any): void {
  const now = Date.now()
  apiCache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  })
}

/**
 * Gera uma chave de cache baseada nos parâmetros da requisição
 */
export function generateCacheKey(prefix: string, dir: string, search: string, page: number, limit: number, all: boolean): string {
  return `${prefix}:${dir}:${search}:${page}:${limit}:${all}`
}

/**
 * Invalida cache baseado em um prefixo
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    // Se não há prefixo, limpar todo o cache
    apiCache.clear()
    return
  }
  
  // Invalidar entradas que começam com o prefixo
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) {
      apiCache.delete(key)
    }
  }
}

/**
 * Gera uma presigned URL para um arquivo do R2 com cache
 */
export async function getSignedUrlForR2(
  s3Client: S3Client,
  bucketName: string,
  key: string
): Promise<string> {
  const cacheKey = `signed:${bucketName}:${key}`
  
  // Verificar cache de signed URLs
  cleanupExpiredEntries(signedUrlCache)
  const cached = signedUrlCache.get(cacheKey)
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url
  }
  
  // Gerar nova presigned URL
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRES
    })
    
    // Armazenar no cache
    signedUrlCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + SIGNED_URL_CACHE_TTL
    })
    
    return url
  } catch (error) {
    console.error('Erro ao gerar presigned URL, usando URL pública:', error)
    // Fallback para URL pública se R2_PUBLIC_URL estiver configurado
    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl) {
      return `${publicUrl}/${key}`
    }
    // Fallback genérico do R2
    const endpoint = process.env.R2_ENDPOINT || 'https://r2.cloudflarestorage.com'
    return `${endpoint}/${bucketName}/${key}`
  }
}

/**
 * Limpa todo o cache (útil para testes ou reset manual)
 */
export function clearAllCache(): void {
  apiCache.clear()
  signedUrlCache.clear()
}

/**
 * Obtém estatísticas do cache (útil para debug)
 */
export function getCacheStats(): { apiEntries: number; signedUrlEntries: number } {
  cleanupExpiredEntries(apiCache)
  cleanupExpiredEntries(signedUrlCache)
  
  return {
    apiEntries: apiCache.size,
    signedUrlEntries: signedUrlCache.size
  }
}
