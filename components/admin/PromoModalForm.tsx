"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { RichTextEditor } from "@/components/admin/RichTextEditor"
import { PromoModalView } from "@/components/PromoModalView"
import { useToast } from "@/hooks/use-sonner-toast"

export type PromoModalFormValues = {
  name: string
  title_html: string
  description_html: string
  title_align: string
  title_color: string
  title_size: string
  title_bold: boolean
  desc_align: string
  desc_color: string
  desc_size: string
  desc_bold: boolean
  background_color: string
  button_text: string
  button_url: string
  button_bg_color: string
  button_text_color: string
  open_delay_seconds: number
  max_displays: number
}

export const DEFAULT_PROMO_MODAL: PromoModalFormValues = {
  name: "",
  title_html: "",
  description_html: "",
  title_align: "center",
  title_color: "#111827",
  title_size: "24",
  title_bold: true,
  desc_align: "center",
  desc_color: "#374151",
  desc_size: "16",
  desc_bold: false,
  background_color: "#ffffff",
  button_text: "Saiba mais",
  button_url: "https://",
  button_bg_color: "#4f46e5",
  button_text_color: "#ffffff",
  open_delay_seconds: 3,
  max_displays: 1,
}

type PromoModalFormProps = {
  initialValues?: PromoModalFormValues
  editingId?: string | null
  onSaved: () => void
  onCancel: () => void
}

const ALIGNS = [
  { value: "left", icon: AlignLeft },
  { value: "center", icon: AlignCenter },
  { value: "right", icon: AlignRight },
]

function AlignControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {ALIGNS.map(({ value: v, icon: Icon }) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant={value === v ? "default" : "outline"}
          className="h-8 w-8 p-0"
          onClick={() => onChange(v)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  )
}

export function PromoModalForm({ initialValues, editingId, onSaved, onCancel }: PromoModalFormProps) {
  const toast = useToast()
  const [values, setValues] = useState<PromoModalFormValues>(initialValues ?? DEFAULT_PROMO_MODAL)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof PromoModalFormValues>(key: K, value: PromoModalFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      toast.error({ title: "Nome obrigatório", description: "Dê um nome interno ao modal." })
      return
    }
    try {
      setSaving(true)
      const url = editingId ? `/api/promo-modal/${editingId}` : "/api/promo-modal"
      const method = editingId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || "Erro ao salvar")
      }
      toast.success({ title: "Salvo", description: "Modal promocional salvo com sucesso." })
      onSaved()
    } catch (error) {
      toast.error({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulário */}
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label>Nome interno</Label>
          <Input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ex.: Promoção de julho"
          />
        </div>

        {/* Título */}
        <div className="space-y-2">
          <Label>Título</Label>
          <RichTextEditor value={values.title_html} onChange={(v) => set("title_html", v)} />
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Alinhamento</span>
              <AlignControl value={values.title_align} onChange={(v) => set("title_align", v)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cor</span>
              <input type="color" value={values.title_color} onChange={(e) => set("title_color", e.target.value)} className="h-8 w-10 rounded border" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tamanho</span>
              <Input type="number" min={8} max={96} value={values.title_size} onChange={(e) => set("title_size", e.target.value)} className="h-8 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Negrito</span>
              <Switch checked={values.title_bold} onCheckedChange={(c) => set("title_bold", c)} />
            </div>
          </div>
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label>Descrição</Label>
          <RichTextEditor value={values.description_html} onChange={(v) => set("description_html", v)} />
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Alinhamento</span>
              <AlignControl value={values.desc_align} onChange={(v) => set("desc_align", v)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cor</span>
              <input type="color" value={values.desc_color} onChange={(e) => set("desc_color", e.target.value)} className="h-8 w-10 rounded border" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tamanho</span>
              <Input type="number" min={8} max={96} value={values.desc_size} onChange={(e) => set("desc_size", e.target.value)} className="h-8 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Negrito</span>
              <Switch checked={values.desc_bold} onCheckedChange={(c) => set("desc_bold", c)} />
            </div>
          </div>
        </div>

        {/* Fundo do modal */}
        <div className="flex items-center gap-2">
          <Label className="min-w-[120px]">Cor de fundo</Label>
          <input type="color" value={values.background_color} onChange={(e) => set("background_color", e.target.value)} className="h-8 w-10 rounded border" />
        </div>

        {/* Botão */}
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Botão de ação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Texto do botão</Label>
              <Input value={values.button_text} onChange={(e) => set("button_text", e.target.value)} placeholder="Ex.: Ver ofertas" />
            </div>
            <div className="space-y-1.5">
              <Label>Link do botão (URL)</Label>
              <Input value={values.button_url} onChange={(e) => set("button_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2">
              <Label className="min-w-[110px]">Cor do botão</Label>
              <input type="color" value={values.button_bg_color} onChange={(e) => set("button_bg_color", e.target.value)} className="h-8 w-10 rounded border" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="min-w-[110px]">Cor do texto</Label>
              <input type="color" value={values.button_text_color} onChange={(e) => set("button_text_color", e.target.value)} className="h-8 w-10 rounded border" />
            </div>
          </div>
        </div>

        {/* Comportamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tempo para abrir (segundos)</Label>
            <Input type="number" min={0} max={120} value={values.open_delay_seconds} onChange={(e) => set("open_delay_seconds", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. de exibições por visitante</Label>
            <Input type="number" min={1} max={100} value={values.max_displays} onChange={(e) => set("max_displays", Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Preview ao vivo */}
      <div className="space-y-2">
        <Label>Pré-visualização</Label>
        <div className="rounded-lg border bg-gray-100 p-6">
          <div className="mx-auto max-w-md">
            <PromoModalView modal={values} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar modal"}
          </Button>
        </div>
      </div>
    </div>
  )
}
