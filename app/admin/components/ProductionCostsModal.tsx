"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save } from "lucide-react"
import { useToast } from "@/hooks/use-sonner-toast"

export type ProductionCostsForm = {
  cutSewPerItem: number
  fabricPerMeter: number
  packagingPerOrder: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (costs: ProductionCostsForm) => void
}

function toInputValue(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return n.toFixed(2).replace(".", ",")
}

function parseInputMoney(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (normalized === "") return 0
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function ProductionCostsModal({ open, onOpenChange, onSaved }: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cutSew, setCutSew] = useState("0,00")
  const [fabric, setFabric] = useState("0,00")
  const [packaging, setPackaging] = useState("0,00")

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/settings/production-costs", { credentials: "include" })
        if (!res.ok) throw new Error("Erro ao carregar custos")
        const data = await res.json()
        const costs = data.costs || {}
        setCutSew(toInputValue(Number(costs.cutSewPerItem) || 0))
        setFabric(toInputValue(Number(costs.fabricPerMeter) || 0))
        setPackaging(toInputValue(Number(costs.packagingPerOrder) || 0))
      } catch (e) {
        toast.error({
          title: "Erro",
          description: e instanceof Error ? e.message : "Erro ao carregar custos",
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const handleSave = async () => {
    const cutSewPerItem = parseInputMoney(cutSew)
    const fabricPerMeter = parseInputMoney(fabric)
    const packagingPerOrder = parseInputMoney(packaging)

    if (cutSewPerItem === null || fabricPerMeter === null || packagingPerOrder === null) {
      toast.error({
        title: "Validação",
        description: "Informe valores numéricos válidos (maior ou igual a zero)",
      })
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/settings/production-costs", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutSewPerItem, fabricPerMeter, packagingPerOrder }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao salvar")
      }
      const costs = data.costs as ProductionCostsForm
      toast.success({ title: "Custos salvos" })
      onSaved(costs)
      onOpenChange(false)
    } catch (e) {
      toast.error({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Custos de produção</DialogTitle>
          <DialogDescription>
            Valores usados no card Custos Produção do dashboard (em reais).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cost-cut-sew">Corte e costura (R$ / item)</Label>
            <Input
              id="cost-cut-sew"
              inputMode="decimal"
              value={cutSew}
              onChange={(e) => setCutSew(e.target.value)}
              disabled={loading || saving}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost-fabric">Tecido sublimado (R$ / metro)</Label>
            <Input
              id="cost-fabric"
              inputMode="decimal"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              disabled={loading || saving}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost-packaging">Embalagem (R$ / pedido)</Label>
            <Input
              id="cost-packaging"
              inputMode="decimal"
              value={packaging}
              onChange={(e) => setPackaging(e.target.value)}
              disabled={loading || saving}
              placeholder="0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
