import { File } from '@google-cloud/storage'

// Constantes de configuração
const CACHE_TTL = 15 * 60 * 1000 // 15 minutos
const SIGNED_URL_EXPIRES = 24 * 60 * 60 * 1000 // 24 horas
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
 * Gera uma signed URL para um arquivo do GCS com cache
 */
export async function getSignedUrl(file: File, bucketName: string): Promise<string> {
  const cacheKey = `signed:${bucketName}:${file.name}`
  
  // Verificar cache de signed URLs
  cleanupExpiredEntries(signedUrlCache)
  const cached = signedUrlCache.get(cacheKey)
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url
  }
  
  // Gerar nova signed URL
  try {
    const expiresAt = Date.now() + SIGNED_URL_EXPIRES
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt
    })
    
    // Armazenar no cache
    signedUrlCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + SIGNED_URL_CACHE_TTL
    })
    
    return url
  } catch (error) {
    console.error('Erro ao gerar signed URL, usando URL pública:', error)
    // Fallback para URL pública
    return `https://storage.googleapis.com/${bucketName}/${file.name}`
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

