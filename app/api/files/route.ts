import { NextResponse } from "next/server"
import path from "path"
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getFromCache, setCache, generateCacheKey, invalidateCache, getSignedUrlForR2 } from '@/lib/r2-cache'

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

// Função auxiliar para obter o S3Client e bucket name
function getBucketAndPath() {
  const s3Client = getS3Client()
  const bucketName = process.env.R2_BUCKET_NAME
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME não configurado")
  }
  return { s3Client, bucketName }
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

// Função auxiliar para listar objetos do R2 com paginação
async function listAllObjects(s3Client: S3Client, bucketName: string, prefix: string): Promise<Array<{ Key: string }>> {
  const allObjects: Array<{ Key: string }> = []
  let continuationToken: string | undefined = undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })

    const response = await s3Client.send(command)
    
    if (response.Contents) {
      allObjects.push(...response.Contents.map(obj => ({ Key: obj.Key! })))
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

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

    // Inicializar R2
    const { s3Client, bucketName } = getBucketAndPath()
    
    // Debug logs para verificar configuração
    console.log('🔍 Environment:', process.env.NODE_ENV || 'development')
    console.log('🔍 Bucket Name:', bucketName)
    
    // Construir prefixo baseado no diretório
    const basePrefix = "public/files/"
    const searchPrefix = dir ? `${basePrefix}${dir}/` : basePrefix

    // Verificar cache antes de buscar do R2
    const cacheKey = generateCacheKey(searchPrefix, dir, search, page, limit, all)
    const cachedData = getFromCache(cacheKey)
    
    if (cachedData) {
      console.log('✅ Retornando dados do cache:', cacheKey)
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
      // Se estamos em um diretório específico, listar imagens diretas desse diretório
      const directFiles = objects.filter(obj => {
        const pathParts = obj.Key.split('/')
        return pathParts.length === 3 && pathParts[2] === dir && /\.(jpg|jpeg|png|webp)$/i.test(obj.Key)
      })
      
      // Gerar signed URLs para imagens do diretório atual
      const imagesWithSignedUrls = await Promise.all(
        directFiles.map(async (obj) => {
          const fileName = obj.Key.split('/').pop()!
          const signedUrl = await getSignedUrlForR2(s3Client, bucketName, obj.Key)
          return {
            name: fileName,
            code: path.parse(fileName).name,
            url: signedUrl,
            category: dir
          }
        })
      )
      currentDirImages = imagesWithSignedUrls
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

    // Armazenar no cache
    setCache(cacheKey, responseData)

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900',
        'X-Cache': 'MISS'
      }
    })
  } catch (error) {
    console.error("Erro ao listar arquivos:", error)
    return NextResponse.json(
      { error: "Erro ao listar arquivos", message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}


export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const action = formData.get("action")
    const dir = (formData.get("dir") as string) || ""

    console.log("API: Recebendo requisição POST", { action, dir })

    const { s3Client, bucketName } = getBucketAndPath()

    switch (action) {
      case "createFolder": {
        const folderName = formData.get("folderName") as string
        console.log("API: Criando pasta", { folderName, dir })

        if (!folderName) {
          console.error("API: Nome da pasta não especificado")
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
          console.error("API: Já existe um arquivo com esse nome", { folderR2Path })
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
          console.error("API: Pasta já existe (já contém arquivos)", { folderR2PathWithSlash })
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
          
          console.log("API: Pasta criada com sucesso", { folderR2PathWithSlash, placeholderPath })
          
          // Invalidar cache relacionado ao diretório
          const basePrefix = "public/files/"
          const dirPrefix = dir ? `${basePrefix}${dir}/` : basePrefix
          invalidateCache(dirPrefix)
          
          return NextResponse.json({ message: "Pasta criada com sucesso" })
        } catch (createError) {
          console.error("API: Erro ao criar pasta no R2", { error: createError, placeholderPath })
          throw new Error(`Erro ao criar pasta: ${createError instanceof Error ? createError.message : "Erro desconhecido"}`)
        }
      }

      case "upload": {
        const file = formData.get("file") as File
        if (!file) {
          return NextResponse.json({ error: "Arquivo não especificado" }, { status: 400 })
        }

        // Sanitizar o nome do arquivo
        const sanitizedFileName = sanitizeName(file.name)
        if (!sanitizedFileName) {
          return NextResponse.json({ error: "Nome do arquivo inválido" }, { status: 400 })
        }

        // Construir o caminho completo no R2
        const r2FilePath = getR2Path(dir, sanitizedFileName)
        console.log("API: Fazendo upload para R2", { r2FilePath })

        // Converter File para Buffer
        const bytes = await file.arrayBuffer()
        let buffer = Buffer.from(bytes)
        let contentType = file.type || "image/jpeg"

        // Processar imagem se for um arquivo de imagem
        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(sanitizedFileName)
        
        if (isImage) {
          try {
            console.log("API: Processando imagem antes do upload", { originalSize: buffer.length, type: file.type })
            
            // Processar com sharp
            const image = sharp(buffer)
            const metadata = await image.metadata()
            
            // Redimensionar se largura > 1800px
            let processedImage = image
            if (metadata.width && metadata.width > 1800) {
              processedImage = processedImage.resize(1800, null, {
                withoutEnlargement: true,
                fit: 'inside'
              })
            }
            
            // Aplicar compressão baseada no formato
            if (file.type === 'image/jpeg' || /\.(jpg|jpeg)$/i.test(sanitizedFileName)) {
              buffer = await processedImage.jpeg({ quality: 80 }).toBuffer()
              contentType = "image/jpeg"
            } else if (file.type === 'image/png' || /\.png$/i.test(sanitizedFileName)) {
              buffer = await processedImage.png({ quality: 80, compressionLevel: 9 }).toBuffer()
              contentType = "image/png"
            } else if (file.type === 'image/webp' || /\.webp$/i.test(sanitizedFileName)) {
              buffer = await processedImage.webp({ quality: 80 }).toBuffer()
              contentType = "image/webp"
            } else {
              // Para outros formatos de imagem, converter para JPEG
              buffer = await processedImage.jpeg({ quality: 80 }).toBuffer()
              contentType = "image/jpeg"
            }
            
            console.log("API: Imagem processada com sucesso", { 
              newSize: buffer.length, 
              originalSize: Buffer.from(bytes).length,
              format: contentType
            })
          } catch (imageError) {
            console.error("API: Erro ao processar imagem, fazendo upload original", { error: imageError })
            // Fallback: usar buffer original se processamento falhar
            buffer = Buffer.from(bytes)
          }
        }

        // Fazer upload para o R2
        const putCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: r2FilePath,
          Body: buffer,
          ContentType: contentType,
        })
        
        await s3Client.send(putCommand)

        console.log("API: Arquivo enviado com sucesso para R2", { r2FilePath })
        
        // Invalidar cache relacionado ao diretório
        const basePrefix = "public/files/"
        const dirPrefix = dir ? `${basePrefix}${dir}/` : basePrefix
        invalidateCache(dirPrefix)
        
        return NextResponse.json({ message: "Arquivo enviado com sucesso" })
      }

      default:
        return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 })
    }
  } catch (error) {
    console.error("Erro ao processar requisição:", error)
    return NextResponse.json(
      { error: "Erro ao processar requisição", message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""
    const itemPath = searchParams.get("path")

    console.log("API: Recebendo requisição DELETE", { dir, itemPath })

    if (!itemPath) {
      console.error("API: Nome do item não especificado")
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

    console.log("API: Caminhos R2 construídos", { r2PathAsFile, r2PathAsFolder })

    // Primeiro, verificar se é um arquivo específico
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: r2PathAsFile,
      })
      
      await s3Client.send(headCommand)
      
      // É um arquivo específico
      console.log("API: Excluindo arquivo", { r2PathAsFile })
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: r2PathAsFile,
        })
        
        await s3Client.send(deleteCommand)
        console.log("API: Arquivo excluído com sucesso")
        
        // Invalidar cache relacionado ao diretório
        const basePrefix = "public/files/"
        const dirPrefix = dir ? `${basePrefix}${dir}/` : basePrefix
        invalidateCache(dirPrefix)
        
        return NextResponse.json({ message: "Arquivo excluído com sucesso" })
      } catch (deleteError) {
        console.error("API: Erro ao excluir arquivo", { error: deleteError, r2PathAsFile })
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
      console.error("API: Item não encontrado", { r2PathAsFile, r2PathAsFolder })
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // É uma pasta - deletar todos os arquivos com esse prefixo
    console.log("API: Excluindo pasta com arquivos", { r2PathAsFolder, count: folderFiles.length })
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
      console.log("API: Pasta excluída com sucesso", { count: folderFiles.length })
      
      // Invalidar cache relacionado ao diretório
      const basePrefix = "public/files/"
      const dirPrefix = dir ? `${basePrefix}${dir}/` : basePrefix
      invalidateCache(dirPrefix)
      
      return NextResponse.json({ message: "Pasta excluída com sucesso" })
    } catch (deleteError) {
      console.error("API: Erro ao excluir pasta", { error: deleteError, r2PathAsFolder })
      return NextResponse.json(
        { 
          error: "Erro ao excluir pasta", 
          message: deleteError instanceof Error ? deleteError.message : "Erro desconhecido"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("API: Erro ao processar exclusão:", error)
    return NextResponse.json(
      { 
        error: "Erro ao processar exclusão", 
        message: error instanceof Error ? error.message : "Erro desconhecido" 
      },
      { status: 500 }
    )
  }
}