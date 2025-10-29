import { NextResponse } from "next/server"
import path from "path"
import { Storage } from '@google-cloud/storage'

// Função para inicializar o Google Cloud Storage
function getStorage() {
  // Detectar se estamos no Cloud Run (verificar variáveis específicas do Cloud Run)
  const isCloudRun = process.env.K_SERVICE || process.env.K_REVISION || process.env.PORT
  
  // No Cloud Run, use Application Default Credentials
  if (isCloudRun) {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      // ADC será usado automaticamente no Cloud Run
    })
  }
  
  // Para desenvolvimento local, use credenciais do .env se disponíveis
  if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY && process.env.GCS_PRIVATE_KEY.trim() !== '') {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    })
  }
  
  // Fallback para ADC local (se gcloud auth application-default login foi executado)
  return new Storage({
    projectId: process.env.GCS_PROJECT_ID,
  })
}

// Função auxiliar para obter o bucket e path GCS
function getBucketAndPath() {
  const storage = getStorage()
  const bucketName = process.env.GCS_BUCKET_NAME
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME não configurado")
  }
  const bucket = storage.bucket(bucketName)
  return { bucket, bucketName }
}

// Função auxiliar para construir o caminho completo no GCS
function getGcsPath(dir: string, filename?: string): string {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""
    const search = searchParams.get("search")?.toLowerCase() || ""
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const all = searchParams.get("all") === "true"

    // Inicializar GCS
    const storage = getStorage()
    const bucketName = process.env.GCS_BUCKET_NAME
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME não configurado")
    }
    
    // Debug logs para verificar configuração
    const isCloudRun = process.env.K_SERVICE || process.env.K_REVISION || process.env.PORT
    console.log('🔍 Environment:', process.env.NODE_ENV || 'development')
    console.log('🔍 Is Cloud Run:', !!isCloudRun)
    console.log('🔍 Bucket Name:', bucketName)
    console.log('🔍 Project ID:', process.env.GCS_PROJECT_ID)
    
    const bucket = storage.bucket(bucketName)
    
    // Construir prefixo baseado no diretório
    const basePrefix = "public/files/"
    const searchPrefix = dir ? `${basePrefix}${dir}/` : basePrefix

    // Listar arquivos do bucket
    const [files] = await bucket.getFiles({ prefix: searchPrefix })
    
    // Agrupar arquivos por categoria (pasta)
    const categoriesMap = new Map<string, any[]>()
    
    files.forEach((file) => {
      // Pular se não for uma imagem
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) return
      
      // Extrair categoria do caminho: public/files/CATEGORIA/imagem.jpg
      const pathParts = file.name.split('/')
      if (pathParts.length < 3) return // Deve ter pelo menos public/files/categoria/imagem
      
      const category = pathParts[2] // public/files/CATEGORIA/imagem.jpg -> CATEGORIA
      const fileName = pathParts[pathParts.length - 1] // último elemento é o nome do arquivo
      
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, [])
      }
      
      categoriesMap.get(category)!.push({
        name: fileName,
        code: path.parse(fileName).name,
        url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
        category: category
      })
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
      const directFiles = files.filter(file => {
        const pathParts = file.name.split('/')
        return pathParts.length === 3 && pathParts[2] === dir && /\.(jpg|jpeg|png|webp)$/i.test(file.name)
      })
      
      currentDirImages = directFiles.map((file) => {
        const fileName = file.name.split('/').pop()!
        return {
          name: fileName,
          code: path.parse(fileName).name,
          url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
          category: dir
        }
      })
    }

    return NextResponse.json({
      categories: paginatedCategories,
      images: currentDirImages,
      pagination: {
        total: totalCategories,
        page,
        limit,
        totalPages
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

    const { bucket } = getBucketAndPath()

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

        // Construir o caminho completo da pasta no GCS
        const folderGcsPath = getGcsPath(dir, sanitizedFolderName)
        const folderGcsPathWithSlash = `${folderGcsPath}/`
        
        // Verificar se já existe um arquivo com esse nome exato (sem extensão)
        const file = bucket.file(folderGcsPath)
        const [fileExists] = await file.exists()
        
        if (fileExists) {
          console.error("API: Já existe um arquivo com esse nome", { folderGcsPath })
          return NextResponse.json({ error: "Já existe um arquivo com esse nome" }, { status: 400 })
        }
        
        // No GCS, pastas são implícitas através de prefixos
        // Verificar se já existem arquivos com esse prefixo (pasta já existe)
        const [existingFiles] = await bucket.getFiles({ prefix: folderGcsPathWithSlash, maxResults: 1 })
        
        if (existingFiles.length > 0) {
          console.error("API: Pasta já existe (já contém arquivos)", { folderGcsPathWithSlash })
          return NextResponse.json({ error: "Pasta já existe" }, { status: 400 })
        }

        // No GCS, não precisamos criar a pasta fisicamente
        // Ela será criada implicitamente quando o primeiro arquivo for enviado
        console.log("API: Pasta validada com sucesso", { folderGcsPathWithSlash })
        return NextResponse.json({ message: "Pasta criada com sucesso" })
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

        // Construir o caminho completo no GCS
        const gcsFilePath = getGcsPath(dir, sanitizedFileName)
        console.log("API: Fazendo upload para GCS", { gcsFilePath })

        // Converter File para Buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Fazer upload para o GCS
        const gcsFile = bucket.file(gcsFilePath)
        await gcsFile.save(buffer, {
          metadata: {
            contentType: file.type || "image/jpeg",
          },
        })

        console.log("API: Arquivo enviado com sucesso para GCS", { gcsFilePath })
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

    const { bucket } = getBucketAndPath()

    // Sanitizar o caminho do item
    const sanitizedItemPath = sanitizeName(itemPath)
    if (!sanitizedItemPath) {
      return NextResponse.json({ error: "Caminho do item inválido" }, { status: 400 })
    }

    // Construir o caminho completo no GCS
    // Se dir está vazio, itemPath é o caminho direto da raiz
    // Se dir tem valor, itemPath é relativo ao dir
    const gcsPathAsFile = getGcsPath(dir, sanitizedItemPath)
    const gcsPathAsFolder = `${gcsPathAsFile}/`

    console.log("API: Caminhos GCS construídos", { gcsPathAsFile, gcsPathAsFolder })

    // Primeiro, verificar se é um arquivo específico
    const file = bucket.file(gcsPathAsFile)
    const [fileExists] = await file.exists()

    if (fileExists) {
      // É um arquivo específico
      console.log("API: Excluindo arquivo", { gcsPathAsFile })
      try {
        await file.delete()
        console.log("API: Arquivo excluído com sucesso")
        return NextResponse.json({ message: "Arquivo excluído com sucesso" })
      } catch (deleteError) {
        console.error("API: Erro ao excluir arquivo", { error: deleteError, gcsPathAsFile })
        return NextResponse.json(
          { 
            error: "Erro ao excluir arquivo", 
            message: deleteError instanceof Error ? deleteError.message : "Erro desconhecido"
          },
          { status: 500 }
        )
      }
    }

    // Se não é arquivo, verificar se é uma pasta (tem arquivos com esse prefixo)
    const [folderFiles] = await bucket.getFiles({ prefix: gcsPathAsFolder })
    
    if (folderFiles.length === 0) {
      console.error("API: Item não encontrado", { gcsPathAsFile, gcsPathAsFolder })
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // É uma pasta - deletar todos os arquivos com esse prefixo
    console.log("API: Excluindo pasta com arquivos", { gcsPathAsFolder, count: folderFiles.length })
    try {
      await Promise.all(folderFiles.map(file => file.delete()))
      console.log("API: Pasta excluída com sucesso", { count: folderFiles.length })
      return NextResponse.json({ message: "Pasta excluída com sucesso" })
    } catch (deleteError) {
      console.error("API: Erro ao excluir pasta", { error: deleteError, gcsPathAsFolder })
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
