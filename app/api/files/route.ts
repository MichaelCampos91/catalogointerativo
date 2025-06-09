import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dir = searchParams.get("dir") || ""

    // Garantir que o caminho está dentro da pasta public/files
    const basePath = path.join(process.cwd(), "public", "files")
    
    // Remover "files" do início do caminho se existir
    const cleanDir = dir.startsWith("files/") ? dir.slice(6) : dir
    const fullPath = path.join(basePath, cleanDir)

    // Verificar se o caminho está dentro da pasta base (segurança)
    if (!fullPath.startsWith(basePath)) {
      return NextResponse.json({ error: "Acesso negado: caminho inválido" }, { status: 403 })
    }

    // Verificar se o diretório existe
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "Diretório não encontrado" }, { status: 404 })
    }

    // Ler o conteúdo do diretório
    const items = fs.readdirSync(fullPath, { withFileTypes: true })

    // Formatar os resultados
    const result = items.map((item) => {
      const isDirectory = item.isDirectory()
      const itemPath = path.join(cleanDir, item.name)

      return {
        name: item.name,
        path: itemPath,
        isDirectory,
        url: isDirectory ? null : `/files/${itemPath}`,
      }
    })

    // Ordenar: diretórios primeiro, depois arquivos
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      currentPath: cleanDir,
      items: result,
    })
  } catch (error) {
    console.error("Erro ao listar arquivos:", error)
    return NextResponse.json(
      {
        error: "Erro ao listar arquivos",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
