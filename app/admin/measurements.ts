/** Formata metros com 2 casas e vírgula (ex.: 1.58 → "1,58"). */
export function formatMeters(meters: number): string {
  return meters.toFixed(2).replace(".", ",")
}

/**
 * Retorna o rótulo de medida para uma quantidade a partir de um mapa
 * quantidade → string já formatada. Fallback: "N/A".
 */
export function getMeasureLabel(
  measureMap: Record<number, string>,
  quantity: number
): string {
  return measureMap[quantity] ?? "N/A"
}

/** Monta mapa quantidade → metros formatados a partir da lista da API. */
export function buildMeasureMap(
  measurements: Array<{ quantity: number; meters: number }>
): Record<number, string> {
  const map: Record<number, string> = {}
  for (const m of measurements) {
    map[m.quantity] = formatMeters(Number(m.meters))
  }
  return map
}
