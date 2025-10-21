import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { writeFile } from "fs/promises"
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

// Função auxiliar para validar o caminho (mantida para compatibilidade com POST/DELETE)
function validatePath(dir: string) {
  const basePath = path.join(process.cwd(), "public", "files")
  // Se o diretório for vazio, retornamos o basePath
  if (!dir) {
    return basePath
  }
  
  // Remover "files/" do início do caminho se existir
  const cleanDir = dir.startsWith("files/") ? dir.slice(6) : dir
  const targetPath = path.join(basePath, cleanDir)
  
  // Verifica se o caminho está dentro da pasta base
  if (!targetPath.startsWith(basePath)) {
    throw new Error("Caminho inválido")
  }
  
  return targetPath
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
    const dir = formData.get("dir") as string

    console.log("API: Recebendo requisição POST", { action, dir })

    // Removemos a validação de dir obrigatório, pois agora aceitamos diretório vazio
    const targetPath = validatePath(dir || "")
    console.log("API: Caminho validado", { targetPath })

    switch (action) {
      case "createFolder": {
        const folderName = formData.get("folderName") as string
        console.log("API: Criando pasta", { folderName })

        if (!folderName) {
          console.error("API: Nome da pasta não especificado")
          return NextResponse.json({ error: "Nome da pasta não especificado" }, { status: 400 })
        }

        const folderPath = path.join(targetPath, folderName)
        console.log("API: Caminho completo da nova pasta", { folderPath })

        if (fs.existsSync(folderPath)) {
          console.error("API: Pasta já existe", { folderPath })
          return NextResponse.json({ error: "Pasta já existe" }, { status: 400 })
        }

        try {
          fs.mkdirSync(folderPath, { recursive: true, mode: 0o775 })
          console.log("API: Pasta criada com sucesso", { folderPath })
          return NextResponse.json({ message: "Pasta criada com sucesso" })
        } catch (mkdirError) {
          console.error("API: Erro ao criar pasta", { error: mkdirError, folderPath })
          return NextResponse.json(
            { error: "Erro ao criar pasta", message: mkdirError instanceof Error ? mkdirError.message : "Erro desconhecido" },
            { status: 500 }
          )
        }
      }

      case "upload": {
        const file = formData.get("file") as File
        if (!file) {
          return NextResponse.json({ error: "Arquivo não especificado" }, { status: 400 })
        }
      
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const filePath = path.join(targetPath, file.name)
      
        fs.writeFileSync(filePath, buffer)
      
        //Permissão 664 garantida aqui
        fs.chmodSync(filePath, 0o664)
        const stat = fs.statSync(filePath)
        console.log("Permissões do arquivo:", stat.mode.toString(8))
      
        console.log("Backend: Arquivo salvo com sucesso", { filePath })
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

    const targetPath = validatePath(path.join(dir, itemPath))
    console.log("API: Caminho validado", { targetPath })
    
    if (!fs.existsSync(targetPath)) {
      console.error("API: Item não encontrado", { targetPath })
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    const stats = fs.statSync(targetPath)
    const isDirectory = stats.isDirectory()

    try {
      if (isDirectory) {
        console.log("API: Excluindo pasta", { targetPath })
        fs.rmSync(targetPath, { recursive: true, force: true })
        console.log("API: Pasta excluída com sucesso")
        return NextResponse.json({ message: "Pasta excluída com sucesso" })
      } else {
        console.log("API: Excluindo arquivo", { targetPath })
        fs.unlinkSync(targetPath)
        console.log("API: Arquivo excluído com sucesso")
        return NextResponse.json({ message: "Arquivo excluído com sucesso" })
      }
    } catch (deleteError) {
      console.error("API: Erro ao excluir item", { error: deleteError, targetPath })
      return NextResponse.json(
        { 
          error: "Erro ao excluir item", 
          message: deleteError instanceof Error ? deleteError.message : "Erro desconhecido",
          details: isDirectory ? "Erro ao excluir pasta" : "Erro ao excluir arquivo"
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
