import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import { buildFolderPath, parseTagList } from "@/lib/folder-tags"
import { ensureSearchSchema, replaceFolderSearchTags } from "@/lib/database"
import { invalidateCache } from "@/lib/r2-cache"

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    await ensureSearchSchema()
    const body = await request.json()
    const dir = typeof body.dir === "string" ? body.dir : ""
    const folderName = typeof body.folderName === "string" ? body.folderName : ""
    if (!Array.isArray(body.tags) || body.tags.some((tag: unknown) => typeof tag !== "string")) {
      return NextResponse.json({ error: "Lista de tags inválida" }, { status: 400 })
    }

    const folderPath = buildFolderPath(dir, folderName)
    if (!folderPath) {
      return NextResponse.json({ error: "Pasta inválida" }, { status: 400 })
    }

    const parsed = parseTagList(body.tags as string[])
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    await replaceFolderSearchTags(folderPath, parsed.tags)
    invalidateCache()
    return NextResponse.json({ tags: parsed.tags, folderPath })
  } catch (error) {
    console.error("Erro ao salvar tags da pasta:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar tags" },
      { status: 500 }
    )
  }
}
