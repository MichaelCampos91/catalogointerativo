"use client"

import { useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Link2Off,
  ImagePlus,
  Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-sonner-toast"

// Extensão de tamanho de fonte baseada em TextStyle (padrão Tiptap).
const FontSizeTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: { fontSize?: string | null }) =>
          attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    }
  },
})

// Imagem com atributo style para largura responsiva (% da largura do modal).
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: "width: 100%; height: auto;",
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attributes: { style?: string | null }) =>
          attributes.style ? { style: attributes.style } : {},
      },
    }
  },
})

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "40"]
const IMAGE_WIDTHS = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
]

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      FontSizeTextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      ResizableImage,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[140px] rounded-md border border-input bg-background px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) {
    return (
      <div className="min-h-[180px] rounded-md border border-input bg-muted/30 animate-pulse" />
    )
  }

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL do link:", previous || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const handleImageButton = () => fileInputRef.current?.click()

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/promo-modal/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || "Falha no upload")
      }
      const data = await res.json()
      editor
        .chain()
        .focus()
        .setImage({ src: data.url } as { src: string })
        .run()
    } catch (error) {
      toast.error({
        title: "Erro ao enviar imagem",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setUploading(false)
    }
  }

  const setImageWidth = (width: string) => {
    editor.chain().focus().updateAttributes("image", { style: `width: ${width}; height: auto;` }).run()
  }

  const btnClass = (active: boolean) =>
    `h-8 w-8 p-0 ${active ? "bg-accent text-accent-foreground" : ""}`

  return (
    <div className="rounded-md border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 p-1">
        <Button type="button" variant="ghost" className={btnClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className={btnClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className={btnClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button type="button" variant="ghost" className={btnClass(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className={btnClass(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button type="button" variant="ghost" className={btnClass(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Alinhar à esquerda">
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className={btnClass(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centralizar">
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className={btnClass(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Alinhar à direita">
          <AlignRight className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={(v) => editor.chain().focus().setMark("textStyle", { fontSize: `${v}px` }).run()}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder="Tam." />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s} value={s}>{s}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-1 cursor-pointer rounded px-1 py-1 hover:bg-accent" title="Cor do texto">
          <span
            className="h-4 w-4 rounded border"
            style={{ backgroundColor: (editor.getAttributes("textStyle").color as string) || "#000000" }}
          />
          <input
            type="color"
            className="h-0 w-0 opacity-0"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button type="button" variant="ghost" className={btnClass(editor.isActive("link"))} onClick={setLink} title="Inserir link">
          <Link2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().unsetLink().run()} title="Remover link">
          <Link2Off className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={handleImageButton} disabled={uploading} title="Inserir imagem">
          <ImagePlus className="h-4 w-4" />
        </Button>
        {editor.isActive("image") && (
          <Select onValueChange={setImageWidth}>
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue placeholder="Largura" />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_WIDTHS.map((w) => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
