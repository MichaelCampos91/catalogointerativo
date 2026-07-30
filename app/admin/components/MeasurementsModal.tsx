"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pencil, Plus, Save, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-sonner-toast"
import { formatMeters } from "../measurements"

export type MeasurementRow = {
  id: string
  quantity: number
  meters: number
  observation: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

const emptyForm = { quantity: "", meters: "", observation: "" }

export function MeasurementsModal({ open, onOpenChange, onChanged }: Props) {
  const toast = useToast()
  const [items, setItems] = useState<MeasurementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MeasurementRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/measurements", { credentials: "include" })
      if (!res.ok) throw new Error("Erro ao carregar medidas")
      const data = await res.json()
      setItems(data.measurements || [])
    } catch (e) {
      toast.error({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao carregar medidas",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setForm(emptyForm)
      setEditingId(null)
      setDeleteTarget(null)
      load()
    }
  }, [open])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const startEdit = (row: MeasurementRow) => {
    setEditingId(row.id)
    setForm({
      quantity: String(row.quantity),
      meters: Number(row.meters).toFixed(2),
      observation: row.observation || "",
    })
  }

  const handleSave = async () => {
    const quantity = Number.parseInt(form.quantity, 10)
    const meters = Number.parseFloat(form.meters.replace(",", "."))
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error({ title: "Validação", description: "Quantidade deve ser um inteiro maior que zero" })
      return
    }
    if (!Number.isFinite(meters) || meters < 0) {
      toast.error({ title: "Validação", description: "Metros deve ser um número maior ou igual a zero" })
      return
    }

    try {
      setSaving(true)
      const payload = {
        quantity,
        meters,
        observation: form.observation.trim(),
      }
      const res = await fetch(editingId ? `/api/measurements/${editingId}` : "/api/measurements", {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao salvar medida")
      }
      toast.success({
        title: editingId ? "Medida atualizada" : "Medida criada",
        description: `Quantidade ${quantity}: ${formatMeters(meters)} m`,
      })
      resetForm()
      await load()
      onChanged()
    } catch (e) {
      toast.error({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/measurements/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao excluir")
      }
      toast.success({ title: "Medida excluída" })
      setDeleteTarget(null)
      if (editingId === deleteTarget.id) resetForm()
      await load()
      onChanged()
    } catch (e) {
      toast.error({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Erro desconhecido",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Medidas</DialogTitle>
            <DialogDescription>
              Cadastre a metragem de tecido por quantidade de unidades. Usada nas listas de produção e no dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border rounded-md p-3 bg-gray-50">
              <div className="space-y-1">
                <Label htmlFor="meas-qty">Quantidade</Label>
                <Input
                  id="meas-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="meas-meters">Metros</Label>
                <Input
                  id="meas-meters"
                  type="text"
                  inputMode="decimal"
                  value={form.meters}
                  onChange={(e) => setForm((f) => ({ ...f, meters: e.target.value }))}
                  placeholder="Ex: 2,22"
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="meas-obs">Observação</Label>
                <Input
                  id="meas-obs"
                  value={form.observation}
                  onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
                  placeholder="Opcional"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancelar
                  </Button>
                )}
                <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
                  {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Nenhuma medida cadastrada.</p>
            ) : (
              <div className="border rounded-md max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Metros</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.id} className={editingId === row.id ? "bg-indigo-50" : undefined}>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{formatMeters(Number(row.meters))}</TableCell>
                        <TableCell className="text-gray-600">{row.observation || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(row)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(row)}
                            aria-label="Excluir"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir medida?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A medida para ${deleteTarget.quantity} unidades (${formatMeters(Number(deleteTarget.meters))} m) será removida.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
