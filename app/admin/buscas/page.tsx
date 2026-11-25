"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type SearchPreset = "this_month" | "last_month" | "last_3_months" | "custom" | "all"
type SearchSort = "count_desc" | "count_asc" | "alpha_asc" | "alpha_desc"

type SearchRow = {
  rank: number
  term: string
  count: number
}

const PRESET_OPTIONS: { value: SearchPreset; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "all", label: "Todo o período" },
  { value: "custom", label: "Período personalizado" },
]

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "count_desc", label: "Quantidade (maior)" },
  { value: "count_asc", label: "Quantidade (menor)" },
  { value: "alpha_asc", label: "A–Z" },
  { value: "alpha_desc", label: "Z–A" },
]

export default function SearchStatsPage() {
  const [preset, setPreset] = useState<SearchPreset>("this_month")
  const [sort, setSort] = useState<SearchSort>("count_desc")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [rows, setRows] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    if (preset === "custom" && (!customFrom || !customTo)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        preset,
        sort,
        page: page.toString(),
      })
      if (preset === "custom") {
        params.set("from", customFrom)
        params.set("to", customTo)
      }
      const response = await fetch(`/api/admin/search-stats?${params.toString()}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.message || "Erro ao carregar termos pesquisados")
      }
      setRows(data.rows ?? [])
      setTotal(Number(data.total) || 0)
      setTotalPages(Number(data.totalPages) || 1)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar termos pesquisados")
    } finally {
      setLoading(false)
    }
  }, [preset, sort, customFrom, customTo, page])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  function changePreset(next: SearchPreset) {
    setPreset(next)
    setPage(1)
  }

  function changeSort(next: SearchSort) {
    setSort(next)
    setPage(1)
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buscas</h1>
        <p className="text-gray-600">Termos normalizados de buscas concluídas no catálogo</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[200px]">
              <Label>Período</Label>
              <Select value={preset} onValueChange={(value) => changePreset(value as SearchPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[200px]">
              <Label>Ordenação</Label>
              <Select value={sort} onValueChange={(value) => changeSort(value as SearchSort)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="search-from">De</Label>
                  <Input
                    id="search-from"
                    type="date"
                    value={customFrom}
                    onChange={(event) => {
                      setCustomFrom(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="search-to">Até</Label>
                  <Input
                    id="search-to"
                    type="date"
                    value={customTo}
                    onChange={(event) => {
                      setCustomTo(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Carregando termos...</p>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" onClick={loadStats}>
                Tentar novamente
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma busca concluída neste período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Ranking</TableHead>
                  <TableHead>Termo</TableHead>
                  <TableHead className="w-32 text-right">Buscas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.term}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell>{row.term}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {total} termo(s) · página {Math.min(page, totalPages)} de {totalPages}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    onClick={(event) => {
                      event.preventDefault()
                      if (page > 1) setPage(page - 1)
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    onClick={(event) => {
                      event.preventDefault()
                      if (page < totalPages) setPage(page + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
