import { NextResponse } from "next/server"
import path from "path"
import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getFromCache, setCache, generateCacheKey, invalidateCache, getSignedUrlForR2 } from '@/lib/r2-cache'

// Função para inicializar o S3Client para Cloudflare R2
function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  
  // Validação detalhada de credenciais
  const missingCredentials: string[] = []
  if (!accountId) missingCredentials.push("R2_ACCOUNT_ID")
  if (!accessKeyId) missingCredentials.push("R2_ACCESS_KEY_ID")
  if (!secretAccessKey) missingCredentials.push("R2_SECRET_ACCESS_KEY")
  
  if (missingCredentials.length > 0) {
    const errorMsg = `Credenciais R2 não configuradas: ${missingCredentials.join(", ")}`
    // console.error("❌ [Backend]", errorMsg)
    throw new Error(errorMsg)
  }

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`
  
  // console.log('✅ [Backend] Credenciais R2 validadas:', {
  //   accountId: accountId.substring(0, 8) + '...',
  //   endpoint,
  //   hasCustomEndpoint: !!process.env.R2_ENDPOINT
  // })

  // Como já validamos que não são undefined, podemos garantir que são strings
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
    },
  })
}

// Função auxiliar para obter o S3Client e bucket name
function getBucketAndPath() {
  try {
    const s3Client = getS3Client()
    const bucketName = process.env.R2_BUCKET_NAME
    
    if (!bucketName) {
      const errorMsg = "R2_BUCKET_NAME não configurado"
      // console.error("❌ [Backend]", errorMsg)
      throw new Error(errorMsg)
    }
    
    // console.log('✅ [Backend] Bucket R2 configurado:', {
    //   bucketName,
    //   timestamp: new Date().toISOString()
    // })
    
    return { s3Client, bucketName }
  } catch (error) {
    // console.error("❌ [Backend] Erro ao obter configuração R2:", {
    //   error,
    //   message: error instanceof Error ? error.message : "Erro desconhecido"
    // })
    throw error
  }
}

// Função auxiliar para construir o caminho completo no R2
function getR2Path(dir: string, filename?: string): string {
  const basePrefix = "public/files/"
  
  // Limpar o diretório: remover "files/" do início se existir
  const cleanDir = dir.startsWith("files/") ? dir.slice(6) : dir
  
  // Construir o caminho
  if (!cleanDir && !filename) {
    return basePrefix
  }
  
  if (!cleanDir && filename) {
    return `${basePrefix}${filename}`
  }
  
  if (cleanDir && filename) {
    return `${basePrefix}${cleanDir}/${filename}`
  }
  
  // Apenas diretório (para verificar pastas)
  return `${basePrefix}${cleanDir}/`
}

// Função auxiliar para validar e sanitizar nomes de pastas/arquivos
function sanitizeName(name: string): string {
  // Remover caracteres perigosos
  return name
    .replace(/\.\./g, "") // Prevenir path traversal
    .replace(/^\/+|\/+$/g, "") // Remover barras no início/fim
    .trim()
}

// Função para normalizar strings (remover acentos, espaços extras e minúsculas)
function normalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[ -]/g, '') // remove acentos
    .replace(/\s+/g, ' ')           // espaços múltiplos para um só
    .trim()                          // remove espaços nas pontas
    .toLowerCase()
}

// Função auxiliar para invalidar cache de múltiplos níveis
// Invalida o cache do diretório atual, do diretório pai (se houver) e da raiz
function invalidateCacheForDir(dir: string) {
  const basePrefix = "public/files/"
  
  // Limpar o diretório: remover "files/" do início se existir
  const cleanDir = dir.startsWith("files/") ? dir.slice(6) : dir
  
  const prefixesToInvalidate: string[] = []
  
  // 1. Invalidar cache do diretório atual
  if (cleanDir) {
    const currentDirPrefix = `${basePrefix}${cleanDir}/`
    prefixesToInvalidate.push(currentDirPrefix)
    // console.log('🗑️ [Backend] Invalidando cache do diretório atual:', currentDirPrefix)
  }
  
  // 2. Invalidar cache do diretório pai (se houver)
  if (cleanDir) {
    const dirParts = cleanDir.split('/').filter(p => p)
    if (dirParts.length > 1) {
      // Tem diretório pai
      const parentDir = dirParts.slice(0, -1).join('/')
      const parentDirPrefix = `${basePrefix}${parentDir}/`
      prefixesToInvalidate.push(parentDirPrefix)
      // console.log('🗑️ [Backend] Invalidando cache do diretório pai:', parentDirPrefix)
    }
  }
  
  // 3. Sempre invalidar cache da raiz para garantir consistência
  prefixesToInvalidate.push(basePrefix)
  // console.log('🗑️ [Backend] Invalidando cache da raiz:', basePrefix)
  
  // Invalidar todos os prefixos
  // console.log(`🗑️ [Backend] Invalidando cache para ${prefixesToInvalidate.length} prefixo(s)`)
  for (const prefix of prefixesToInvalidate) {
    invalidateCache(prefix)
    // console.log(`✅ [Backend] Cache invalidado para: "${prefix}"`)
  }
  
  // console.log(`✅ [Backend] Invalidação de cache concluída para diretório: "${dir}"`)
}

// Função auxiliar para listar objetos do R2 com paginação
async function listAllObjects(s3Client: S3Client, bucketName: string, prefix: string): Promise<Array<{ Key: string }>> {
  const allObjects: Array<{ Key: string }> = []
  let continuationToken: string | undefined = undefined
  let attempt = 0
  const maxAttempts = 3

  do {
    try {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })

      // console.log(`📋 [Backend] Listando objetos R2 (tentativa ${attempt + 1}/${maxAttempts}):`, {
      //   bucket: bucketName,
      //   prefix,
      //   hasContinuationToken: !!continuationToken
      // })

      const response: ListObjectsV2CommandOutput = await s3Client.send(command)
      
      if (response.Contents) {
        allObjects.push(...response.Contents.map((obj: { Key?: string }) => ({ Key: obj.Key! })))
        // console.log(`✅ [Backend] ${response.Contents.length} objetos encontrados nesta página`)
      }

      continuationToken = response.NextContinuationToken
      attempt = 0 // Reset attempt counter on success
    } catch (error) {
      attempt++
      // console.error(`❌ [Backend] Erro ao listar objetos R2 (tentativa ${attempt}/${maxAttempts}):`, {
      //   error,
      //   message: error instanceof Error ? error.message : "Erro desconhecido",
      //   prefix,
      //   bucket: bucketName
      // })
      
      if (attempt >= maxAttempts) {
        // console.error("❌ [Backend] Número máximo de tentativas excedido ao listar objetos R2")
        throw new Error(`Erro ao listar objetos do R2 após ${maxAttempts} tentativas: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
      }
      
      // Aguardar antes de tentar novamente (exponential backoff simples)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  } while (continuationToken)

  // console.log(`✅ [Backend] Total de objetos listados: ${allObjects.length}`)
  return allObjects
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""
    const search = searchParams.get("search")?.toLowerCase() || ""
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const all = searchParams.get("all") === "true"
    const forceReload = searchParams.has("_t") // Verificar se há parâmetro de cache-busting

    // Inicializar R2
    const { s3Client, bucketName } = getBucketAndPath()
    
    // Debug logs para verificar configuração
    // console.log('🔍 Environment:', process.env.NODE_ENV || 'development')
    // console.log('🔍 Bucket Name:', bucketName)
    // console.log('🔍 Force Reload:', forceReload)
    
    // Construir prefixo baseado no diretório
    const basePrefix = "public/files/"
    const searchPrefix = dir ? `${basePrefix}${dir}/` : basePrefix

    // Verificar cache antes de buscar do R2 (mas ignorar se forceReload for true)
    const cacheKey = generateCacheKey(searchPrefix, dir, search, page, limit, all)
    const cachedData = !forceReload ? getFromCache(cacheKey) : null
    
    if (cachedData) {
      // console.log('✅ Retornando dados do cache:', cacheKey)
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, max-age=900',
          'X-Cache': 'HIT'
        }
      })
    }

    // Listar arquivos do bucket
    const objects = await listAllObjects(s3Client, bucketName, searchPrefix)
    
    // Agrupar arquivos por categoria (pasta)
    const categoriesMap = new Map<string, any[]>()
    const foldersSet = new Set<string>() // Para detectar pastas vazias (com apenas .folder)
    const filesToProcess: Array<{ key: string; category: string; fileName: string }> = []
    
    // Primeiro passo: processar arquivos e coletar os que precisam de signed URLs
    for (const obj of objects) {
      const key = obj.Key
      
      // Ignorar arquivos .folder (marcadores de pasta vazia)
      if (key.endsWith('.folder')) {
        // Extrair o nome da pasta do arquivo .folder
        // Exemplo: public/files/CATEGORIA/.folder -> CATEGORIA
        // Exemplo: public/files/DIR/SUBPASTA/.folder -> SUBPASTA (quando dir=DIR)
        const pathParts = key.replace(basePrefix, '').split('/').filter(p => p && p !== '.folder')
        if (pathParts.length > 0) {
          const folderName = pathParts[pathParts.length - 1]
          
          // Se estamos na raiz (dir vazio), pegar a primeira pasta
          // Se estamos em um diretório, pegar a pasta do nível imediatamente abaixo
          if (!dir) {
            // Na raiz: public/files/CATEGORIA/.folder -> categoria é CATEGORIA
            if (pathParts.length === 1) {
              foldersSet.add(folderName)
            }
          } else {
            // Dentro de um dir: public/files/DIR/SUBPASTA/.folder -> categoria é SUBPASTA
            const dirParts = dir.split('/').filter(p => p)
            if (pathParts.length === dirParts.length + 1) {
              const expectedDir = pathParts.slice(0, -1).join('/')
              if (expectedDir === dir.replace(/\/+$/, '')) {
                foldersSet.add(folderName)
              }
            }
          }
        }
        continue
      }
      
      // Pular se não for uma imagem
      if (!/\.(jpg|jpeg|png|webp)$/i.test(key)) continue
      
      // Extrair categoria do caminho: public/files/CATEGORIA/imagem.jpg
      const pathParts = key.split('/')
      if (pathParts.length < 3) continue // Deve ter pelo menos public/files/categoria/imagem
      
      // Determinar qual é a categoria baseado no contexto
      let category: string
      let fileName: string
      
      if (!dir) {
        // Na raiz: public/files/CATEGORIA/imagem.jpg -> categoria é CATEGORIA
        category = pathParts[2]
        fileName = pathParts[pathParts.length - 1]
      } else {
        // Dentro de um diretório: precisamos verificar se está no nível correto
        const dirParts = dir.split('/').filter(p => p)
        const filePathParts = key.replace(basePrefix, '').split('/').filter(p => p)
        
        // Se o arquivo está diretamente no diretório especificado (não em subpasta)
        if (filePathParts.length === dirParts.length + 1) {
          const fileDir = filePathParts.slice(0, -1).join('/')
          if (fileDir === dir.replace(/\/+$/, '')) {
            // É uma imagem no diretório atual, não uma categoria
            // Isso será tratado no currentDirImages abaixo
            continue
          }
        }
        
        // Se o arquivo está em uma subpasta do diretório
        if (filePathParts.length === dirParts.length + 2) {
          const fileDir = filePathParts.slice(0, -1).join('/')
          const expectedDir = dirParts.join('/')
          if (filePathParts.slice(0, -2).join('/') === expectedDir) {
            category = filePathParts[filePathParts.length - 2]
            fileName = filePathParts[filePathParts.length - 1]
          } else {
            continue
          }
        } else {
          // Arquivo não está no contexto esperado
          continue
        }
      }
      
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, [])
      }
      
      // Coletar arquivo para processar signed URLs depois
      filesToProcess.push({ key, category, fileName })
    }
    
    // Segundo passo: gerar todas as signed URLs em paralelo
    const signedUrlPromises = filesToProcess.map(({ key }) => getSignedUrlForR2(s3Client, bucketName, key))
    const signedUrls = await Promise.all(signedUrlPromises)
    
    // Terceiro passo: adicionar arquivos com signed URLs ao mapa de categorias
    filesToProcess.forEach(({ category, fileName }, index) => {
      categoriesMap.get(category)!.push({
        name: fileName,
        code: path.parse(fileName).name,
        url: signedUrls[index],
        category: category
      })
    })

    // Adicionar pastas vazias (que só têm .folder) às categorias
    foldersSet.forEach(folderName => {
      if (!categoriesMap.has(folderName)) {
        categoriesMap.set(folderName, [])
      }
    })

    // Converter para array de categorias
    let categories = Array.from(categoriesMap.entries()).map(([categoryName, images]) => ({
      id: categoryName,
      name: categoryName,
      slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
      images: images
    }))

    // Aplicar filtro de busca se especificado
    if (search) {
      const normalizedSearch = normalize(search)
      categories = categories.filter((cat) => normalize(cat.name).includes(normalizedSearch))
    }

    // Paginação de categorias
    const totalCategories = categories.length
    const totalPages = Math.max(1, Math.ceil(totalCategories / limit))
    const paginatedCategories = all ? categories : categories.slice((page - 1) * limit, page * limit)

    // Listar imagens do diretório atual (não das subpastas) - para compatibilidade
    let currentDirImages: any[] = []
    if (dir) {
      // Construir o prefixo correto para o diretório atual
      // Exemplo: se dir = "AAAA", prefixo = "public/files/AAAA/"
      // Exemplo: se dir = "AAAA/BBBB", prefixo = "public/files/AAAA/BBBB/"
      const cleanDir = dir.startsWith("files/") ? dir.slice(6) : dir
      const dirPrefix = `${basePrefix}${cleanDir}/`
      
      // console.log('🔍 Listando imagens do diretório atual:', { dir, cleanDir, dirPrefix })
      
      // Filtrar arquivos que:
      // 1. Começam com o prefixo do diretório
      // 2. São imagens (jpg, jpeg, png, webp)
      // 3. Estão diretamente no diretório (não em subpastas)
      //    Ou seja: o caminho após o prefixo não contém mais "/"
      const directFiles = objects.filter(obj => {
        const key = obj.Key
        
        // Deve começar com o prefixo do diretório
        if (!key.startsWith(dirPrefix)) {
          return false
        }
        
        // Deve ser uma imagem
        if (!/\.(jpg|jpeg|png|webp)$/i.test(key)) {
          return false
        }
        
        // Ignorar arquivos .folder
        if (key.endsWith('.folder')) {
          return false
        }
        
        // Verificar se está diretamente no diretório (não em subpasta)
        // Remover o prefixo e verificar se não há mais "/"
        const relativePath = key.replace(dirPrefix, '')
        const isDirectFile = !relativePath.includes('/')
        
        return isDirectFile
      })
      
      // console.log(`✅ Encontradas ${directFiles.length} imagens diretas no diretório ${dir}`)
      
      // Gerar signed URLs para imagens do diretório atual
      const imagesWithSignedUrls = await Promise.all(
        directFiles.map(async (obj) => {
          const fileName = obj.Key.split('/').pop()!
          const signedUrl = await getSignedUrlForR2(s3Client, bucketName, obj.Key)
          // console.log(`📷 Gerando signed URL para: ${fileName} -> ${signedUrl.substring(0, 50)}...`)
          return {
            name: fileName,
            code: path.parse(fileName).name,
            url: signedUrl,
            category: dir
          }
        })
      )
      currentDirImages = imagesWithSignedUrls
      // console.log(`✅ Total de imagens processadas: ${currentDirImages.length}`)
    }

    const responseData = {
      categories: paginatedCategories,
      images: currentDirImages,
      pagination: {
        total: totalCategories,
        page,
        limit,
        totalPages
      }
    }

    // Armazenar no cache apenas se não for forceReload
    if (!forceReload) {
      setCache(cacheKey, responseData)
    } else {
      // console.log('🔄 [Backend] Force reload detectado, não armazenando no cache do servidor')
    }

    // Ajustar headers de cache baseado em forceReload
    const cacheHeaders: Record<string, string> = forceReload
      ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache': 'MISS-FORCED'
        }
      : {
          'Cache-Control': 'public, max-age=60', // Cache mais curto para dados novos
          'X-Cache': 'MISS'
        }

    return NextResponse.json(responseData, {
      headers: cacheHeaders
    })
  } catch (error) {
    // console.error("❌ [Backend] Erro ao listar arquivos:", {
    //   error,
    //   message: error instanceof Error ? error.message : "Erro desconhecido",
    //   stack: error instanceof Error ? error.stack : undefined,
    //   dir,
    //   name: error instanceof Error ? error.name : typeof error
    // })
    
    // Mensagens de erro mais descritivas
    let errorMessage = "Erro ao listar arquivos"
    let statusCode = 500
    
    if (error instanceof Error) {
      // Erros relacionados a credenciais R2
      if (error.message.includes("Credenciais") || error.message.includes("R2") || error.message.includes("não configurado")) {
        errorMessage = "Erro de configuração do CloudFlare R2. Verifique as credenciais."
        statusCode = 500
      }
      // Erros de rede/conexão
      else if (error.message.includes("ECONNREFUSED") || error.message.includes("timeout") || error.message.includes("ENOTFOUND")) {
        errorMessage = "Erro de conexão com o CloudFlare R2. Tente novamente."
        statusCode = 503
      }
      // Outros erros
      else {
        errorMessage = error.message || "Erro desconhecido ao listar arquivos"
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      },
      { status: statusCode }
    )
  }
}


export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const action = formData.get("action")
    const dir = (formData.get("dir") as string) || ""

    // console.log("API: Recebendo requisição POST", { action, dir })

    const { s3Client, bucketName } = getBucketAndPath()

    switch (action) {
      case "createFolder": {
        const folderName = formData.get("folderName") as string
        // console.log("API: Criando pasta", { folderName, dir })

        if (!folderName) {
          // console.error("API: Nome da pasta não especificado")
          return NextResponse.json({ error: "Nome da pasta não especificado" }, { status: 400 })
        }

        // Sanitizar o nome da pasta
        const sanitizedFolderName = sanitizeName(folderName)
        if (!sanitizedFolderName) {
          return NextResponse.json({ error: "Nome da pasta inválido" }, { status: 400 })
        }

        // Construir o caminho completo da pasta no R2
        const folderR2Path = getR2Path(dir, sanitizedFolderName)
        const folderR2PathWithSlash = `${folderR2Path}/`
        
        // Verificar se já existe um arquivo com esse nome exato (sem extensão)
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: bucketName,
            Key: folderR2Path,
          })
          await s3Client.send(headCommand)
          
          // Se chegou aqui, o arquivo existe
          // console.error("API: Já existe um arquivo com esse nome", { folderR2Path })
          return NextResponse.json({ error: "Já existe um arquivo com esse nome" }, { status: 400 })
        } catch (error: any) {
          // Se não encontrou (404), continua
          if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) {
            throw error
          }
        }
        
        // No R2, pastas são implícitas através de prefixos
        // Verificar se já existem arquivos com esse prefixo (pasta já existe)
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: folderR2PathWithSlash,
          MaxKeys: 1,
        })
        
        const listResponse = await s3Client.send(listCommand)
        
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          // console.error("API: Pasta já existe (já contém arquivos)", { folderR2PathWithSlash })
          return NextResponse.json({ error: "Pasta já existe" }, { status: 400 })
        }

        // No R2, precisamos criar um arquivo placeholder para que a pasta apareça nas listagens
        // Criamos um arquivo marcador vazio dentro da pasta
        const placeholderPath = `${folderR2PathWithSlash}.folder`
        
        try {
          // Criar arquivo placeholder vazio
          const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: placeholderPath,
            Body: "",
            ContentType: "application/x-directory",
          })
          
          await s3Client.send(putCommand)
          
          // console.log("API: Pasta criada com sucesso", { folderR2PathWithSlash, placeholderPath })
          
          // Invalidar cache relacionado ao diretório (atual, pai e raiz)
          // console.log('🗑️ [Backend] Invalidando cache após criação de pasta')
          invalidateCacheForDir(dir)
          
          return NextResponse.json({ message: "Pasta criada com sucesso" })
        } catch (createError) {
          // console.error("API: Erro ao criar pasta no R2", { error: createError, placeholderPath })
          throw new Error(`Erro ao criar pasta: ${createError instanceof Error ? createError.message : "Erro desconhecido"}`)
        }
      }

      case "upload": {
        // console.log('📤 [Backend] Iniciando processo de upload...', { dir, timestamp: new Date().toISOString() })
        
        const file = formData.get("file") as File
        if (!file) {
          // console.error('❌ [Backend] Arquivo não especificado na requisição')
          return NextResponse.json({ error: "Arquivo não especificado" }, { status: 400 })
        }

        // console.log('📄 [Backend] Arquivo recebido:', {
        //   name: file.name,
        //   size: file.size,
        //   type: file.type,
        //   lastModified: new Date(file.lastModified).toISOString()
        // })

        // Sanitizar o nome do arquivo
        const sanitizedFileName = sanitizeName(file.name)
        if (!sanitizedFileName) {
          // console.error('❌ [Backend] Nome do arquivo inválido após sanitização:', {
          //   originalName: file.name,
          //   sanitized: sanitizedFileName
          // })
          return NextResponse.json({ error: "Nome do arquivo inválido" }, { status: 400 })
        }

        // console.log('✅ [Backend] Nome do arquivo sanitizado:', {
        //   original: file.name,
        //   sanitized: sanitizedFileName
        // })

        // Construir o caminho completo no R2
        const r2FilePath = getR2Path(dir, sanitizedFileName)
        // console.log('🗂️ [Backend] Caminho R2 construído:', {
        //   dir,
        //   sanitizedFileName,
        //   r2FilePath
        // })

        // Converter File para Buffer
        // console.log('🔄 [Backend] Convertendo arquivo para Buffer...')
        const bytes = await file.arrayBuffer()
        let buffer: Buffer = Buffer.from(bytes)
        let contentType = file.type || "image/jpeg"
        
        // console.log('📊 [Backend] Buffer criado:', {
        //   size: buffer.length,
        //   contentType: contentType
        // })

        // Processar imagem se for um arquivo de imagem
        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(sanitizedFileName)
        // console.log('🖼️ [Backend] Verificando se é imagem:', { isImage, fileType: file.type })
        
        if (isImage) {
          try {
            // console.log("🖼️ [Backend] Processando imagem antes do upload", { 
            //   originalSize: buffer.length, 
            //   type: file.type,
            //   fileName: sanitizedFileName
            // })
            
            // Processar com sharp
            const image = sharp(buffer)
            const metadata = await image.metadata()
            
            // console.log('📐 [Backend] Metadados da imagem:', {
            //   width: metadata.width,
            //   height: metadata.height,
            //   format: metadata.format,
            //   hasAlpha: metadata.hasAlpha,
            //   channels: metadata.channels
            // })
            
            // Redimensionar se largura > 1800px
            let processedImage = image
            if (metadata.width && metadata.width > 1800) {
              // console.log(`📏 [Backend] Redimensionando imagem (largura ${metadata.width}px > 1800px)`)
              processedImage = processedImage.resize(1800, null, {
                withoutEnlargement: true,
                fit: 'inside'
              })
            } else {
              // console.log('✅ [Backend] Imagem não precisa ser redimensionada')
            }
            
            // Aplicar compressão baseada no formato
            const originalSize = buffer.length
            let processedBuffer: Buffer
            if (file.type === 'image/jpeg' || /\.(jpg|jpeg)$/i.test(sanitizedFileName)) {
              // console.log('🔄 [Backend] Convertendo para JPEG com qualidade 80')
              processedBuffer = Buffer.from(await processedImage.jpeg({ quality: 80 }).toBuffer())
              contentType = "image/jpeg"
            } else if (file.type === 'image/png' || /\.png$/i.test(sanitizedFileName)) {
              // console.log('🔄 [Backend] Convertendo para PNG com qualidade 80 e compressão 9')
              processedBuffer = Buffer.from(await processedImage.png({ quality: 80, compressionLevel: 9 }).toBuffer())
              contentType = "image/png"
            } else if (file.type === 'image/webp' || /\.webp$/i.test(sanitizedFileName)) {
              // console.log('🔄 [Backend] Convertendo para WebP com qualidade 80')
              processedBuffer = Buffer.from(await processedImage.webp({ quality: 80 }).toBuffer())
              contentType = "image/webp"
            } else {
              // Para outros formatos de imagem, converter para JPEG
              // console.log('🔄 [Backend] Convertendo formato desconhecido para JPEG')
              processedBuffer = Buffer.from(await processedImage.jpeg({ quality: 80 }).toBuffer())
              contentType = "image/jpeg"
            }
            buffer = processedBuffer
            
            const compressionRatio = ((originalSize - buffer.length) / originalSize * 100).toFixed(2)
            // console.log("✅ [Backend] Imagem processada com sucesso", { 
            //   originalSize,
            //   newSize: buffer.length, 
            //   compressionRatio: `${compressionRatio}%`,
            //   format: contentType
            // })
          } catch (imageError) {
            // console.error("❌ [Backend] Erro ao processar imagem, fazendo upload original", { 
            //   error: imageError,
            //   message: imageError instanceof Error ? imageError.message : "Erro desconhecido",
            //   stack: imageError instanceof Error ? imageError.stack : undefined
            // })
            // Fallback: usar buffer original se processamento falhar
            buffer = Buffer.from(bytes)
            // console.log('⚠️ [Backend] Usando buffer original como fallback')
          }
        } else {
          // console.log('📄 [Backend] Arquivo não é uma imagem, fazendo upload direto')
        }

        // Fazer upload para o R2
        // console.log('☁️ [Backend] Iniciando upload para R2...', {
        //   bucket: bucketName,
        //   key: r2FilePath,
        //   size: buffer.length,
        //   contentType
        // })
        
        const putCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: r2FilePath,
          Body: buffer,
          ContentType: contentType,
        })
        
        try {
          const uploadStartTime = Date.now()
          await s3Client.send(putCommand)
          const uploadTime = Date.now() - uploadStartTime
          
          // console.log("✅ [Backend] Arquivo enviado com sucesso para R2", { 
          //   r2FilePath,
          //   uploadTime: `${uploadTime}ms`,
          //   size: buffer.length
          // })
        } catch (uploadError) {
          // console.error("❌ [Backend] Erro ao fazer upload para R2", {
          //   error: uploadError,
          //   message: uploadError instanceof Error ? uploadError.message : "Erro desconhecido",
          //   stack: uploadError instanceof Error ? uploadError.stack : undefined,
          //   r2FilePath,
          //   bucketName
          // })
          throw uploadError
        }
        
        // Invalidar cache relacionado ao diretório (atual, pai e raiz)
        // console.log('🗑️ [Backend] Invalidando cache após upload')
        invalidateCacheForDir(dir)
        
        // console.log('🎉 [Backend] Upload concluído com sucesso!')
        return NextResponse.json({ message: "Arquivo enviado com sucesso" })
      }

      default:
        return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 })
    }
  } catch (error) {
    // console.error("❌ [Backend] Erro ao processar requisição POST:", {
    //   error,
    //   message: error instanceof Error ? error.message : "Erro desconhecido",
    //   stack: error instanceof Error ? error.stack : undefined,
    //   name: error instanceof Error ? error.name : typeof error
    // })
    
    // Mensagens de erro mais descritivas baseadas no tipo de erro
    let errorMessage = "Erro ao processar requisição"
    let statusCode = 500
    
    if (error instanceof Error) {
      // Erros relacionados a credenciais R2
      if (error.message.includes("Credenciais") || error.message.includes("R2")) {
        errorMessage = "Erro de configuração do CloudFlare R2. Verifique as credenciais."
        statusCode = 500
      }
      // Erros de rede/conexão
      else if (error.message.includes("ECONNREFUSED") || error.message.includes("timeout")) {
        errorMessage = "Erro de conexão com o CloudFlare R2. Tente novamente."
        statusCode = 503
      }
      // Erros de validação
      else if (error.message.includes("inválido") || error.message.includes("não especificado")) {
        errorMessage = error.message
        statusCode = 400
      }
      // Outros erros
      else {
        errorMessage = error.message || "Erro desconhecido ao processar requisição"
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      },
      { status: statusCode }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""
    const itemPath = searchParams.get("path")

    // console.log("API: Recebendo requisição DELETE", { dir, itemPath })

    if (!itemPath) {
      // console.error("API: Nome do item não especificado")
      return NextResponse.json({ error: "Nome do item não especificado" }, { status: 400 })
    }

    const { s3Client, bucketName } = getBucketAndPath()

    // Sanitizar o caminho do item
    const sanitizedItemPath = sanitizeName(itemPath)
    if (!sanitizedItemPath) {
      return NextResponse.json({ error: "Caminho do item inválido" }, { status: 400 })
    }

    // Construir o caminho completo no R2
    // Se dir está vazio, itemPath é o caminho direto da raiz
    // Se dir tem valor, itemPath é relativo ao dir
    const r2PathAsFile = getR2Path(dir, sanitizedItemPath)
    const r2PathAsFolder = `${r2PathAsFile}/`

    // console.log("API: Caminhos R2 construídos", { r2PathAsFile, r2PathAsFolder })

    // Primeiro, verificar se é um arquivo específico
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: r2PathAsFile,
      })
      
      await s3Client.send(headCommand)
      
      // É um arquivo específico
      // console.log("API: Excluindo arquivo", { r2PathAsFile })
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: r2PathAsFile,
        })
        
        await s3Client.send(deleteCommand)
        // console.log("API: Arquivo excluído com sucesso")
        
        // Invalidar cache relacionado ao diretório (atual, pai e raiz)
        // console.log('🗑️ [Backend] Invalidando cache após exclusão de arquivo')
        invalidateCacheForDir(dir)
        
        return NextResponse.json({ message: "Arquivo excluído com sucesso" })
      } catch (deleteError) {
        // console.error("API: Erro ao excluir arquivo", { error: deleteError, r2PathAsFile })
        return NextResponse.json(
          { 
            error: "Erro ao excluir arquivo", 
            message: deleteError instanceof Error ? deleteError.message : "Erro desconhecido"
          },
          { status: 500 }
        )
      }
    } catch (headError: any) {
      // Se não encontrou o arquivo, verificar se é uma pasta
      if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
        throw headError
      }
    }

    // Se não é arquivo, verificar se é uma pasta (tem arquivos com esse prefixo)
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: r2PathAsFolder,
    })
    
    const listResponse = await s3Client.send(listCommand)
    const folderFiles = listResponse.Contents || []
    
    if (folderFiles.length === 0) {
      // console.error("API: Item não encontrado", { r2PathAsFile, r2PathAsFolder })
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // É uma pasta - deletar todos os arquivos com esse prefixo
    // console.log("API: Excluindo pasta com arquivos", { r2PathAsFolder, count: folderFiles.length })
    try {
      await Promise.all(
        folderFiles.map(file => {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: file.Key!,
          })
          return s3Client.send(deleteCommand)
        })
      )
      // console.log("API: Pasta excluída com sucesso", { count: folderFiles.length })
      
      // Invalidar cache relacionado ao diretório (atual, pai e raiz)
      // console.log('🗑️ [Backend] Invalidando cache após exclusão de pasta')
      invalidateCacheForDir(dir)
      
      return NextResponse.json({ message: "Pasta excluída com sucesso" })
    } catch (deleteError) {
      // console.error("API: Erro ao excluir pasta", { error: deleteError, r2PathAsFolder })
      return NextResponse.json(
        { 
          error: "Erro ao excluir pasta", 
          message: deleteError instanceof Error ? deleteError.message : "Erro desconhecido"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    // console.error("❌ [Backend] Erro ao processar exclusão:", {
    //   error,
    //   message: error instanceof Error ? error.message : "Erro desconhecido",
    //   stack: error instanceof Error ? error.stack : undefined,
    //   dir,
    //   itemPath,
    //   name: error instanceof Error ? error.name : typeof error
    // })
    
    // Mensagens de erro mais descritivas
    let errorMessage = "Erro ao processar exclusão"
    let statusCode = 500
    
    if (error instanceof Error) {
      // Erros relacionados a credenciais R2
      if (error.message.includes("Credenciais") || error.message.includes("R2") || error.message.includes("não configurado")) {
        errorMessage = "Erro de configuração do CloudFlare R2. Verifique as credenciais."
        statusCode = 500
      }
      // Erros de rede/conexão
      else if (error.message.includes("ECONNREFUSED") || error.message.includes("timeout") || error.message.includes("ENOTFOUND")) {
        errorMessage = "Erro de conexão com o CloudFlare R2. Tente novamente."
        statusCode = 503
      }
      // Erros de não encontrado
      else if (error.message.includes("não encontrado") || error.message.includes("NotFound")) {
        errorMessage = error.message
        statusCode = 404
      }
      // Outros erros
      else {
        errorMessage = error.message || "Erro desconhecido ao processar exclusão"
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      },
      { status: statusCode }
    )
  }
}