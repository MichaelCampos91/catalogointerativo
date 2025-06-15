import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { writeFile } from "fs/promises"

// Função auxiliar para validar o caminho
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""

    const targetPath = validatePath(dir)
    
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Diretório não encontrado" }, { status: 404 })
    }

    const items = fs.readdirSync(targetPath, { withFileTypes: true })
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""

    const files = items.map((item) => {
      const itemPath = path.join(dir, item.name)
      const fullPath = path.join(targetPath, item.name)
      const stats = fs.statSync(fullPath)
      
      return {
        name: item.name,
        path: itemPath,
        isDirectory: item.isDirectory(),
        url: item.isDirectory() ? null : `/files/${itemPath}`,
        size: stats.size,
        modified: stats.mtime
      }
    })

    return NextResponse.json({
      currentPath: dir,
      items: files
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

        // Definir permissões do arquivo como 664 (rw-rw-r--)
        fs.chmodSync(filePath, 0o664)

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
