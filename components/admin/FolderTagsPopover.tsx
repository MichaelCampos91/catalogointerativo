"use client"

import { useEffect, useState } from "react"
import { Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/use-toast"
import { cleanTagText, parseTagList, splitTagInput } from "@/lib/folder-tags"

type FolderTagsPopoverProps = {
  dir: string
  folderName: string
  tags: string[]
  onSaved: (tags: string[]) => void
}

export function FolderTagsPopover({ dir, folderName, tags, onSaved }: FolderTagsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(tags)
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(tags)
    setInput("")
    setError(null)
  }, [open, tags])

  function commitParts(parts: string[], remainder: string) {
    let next = [...draft]
    for (const part of parts) {
      const parsed = parseTagList([...next, part])
      if (parsed.error) {
        setDraft(next)
        setInput(cleanTagText(part))
        setError(parsed.error)
        return
      }
      next = parsed.tags
    }
    setDraft(next)
    setInput(remainder)
    setError(null)
  }

  function handleInputChange(value: string) {
    if (value.includes(",")) {
      const split = splitTagInput(value)
      commitParts(split.committed, split.remainder)
      return
    }
    setInput(value)
    if (error) setError(null)
  }

  function removeTag(index: number) {
    setDraft((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setError(null)
  }

  async function save() {
    const pending = cleanTagText(input)
    const parsed = parseTagList(pending ? [...draft, pending] : draft)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/folder-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, folderName, tags: parsed.tags }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.message || "Erro ao salvar tags")
      }
      onSaved(data.tags ?? parsed.tags)
      toast({ title: "Sucesso", description: "Tags de busca atualizadas" })
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar tags")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={tags.length > 0 ? `Tags de busca (${tags.length})` : "Tags de busca"}
          className={
            tags.length > 0
              ? "text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50"
              : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          }
          onClick={(event) => event.stopPropagation()}
        >
          <Tag className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Tags de busca</p>
            <p className="text-xs text-gray-500">Até 3 palavras por tag, separadas por vírgula.</p>
          </div>
          {draft.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-2 py-1 text-xs text-gray-800"
                >
                  {tag}
                  <button
                    type="button"
                    className="rounded-full text-gray-500 hover:text-gray-900"
                    aria-label={`Remover tag ${tag}`}
                    onClick={() => removeTag(index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            value={input}
            maxLength={80}
            placeholder="Ex.: chá de bebê, safari"
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                const pending = cleanTagText(input)
                if (!pending) return
                commitParts([pending], "")
              }
              if (event.key === "Backspace" && input === "" && draft.length > 0) {
                removeTag(draft.length - 1)
              }
            }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
