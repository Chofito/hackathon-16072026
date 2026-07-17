const currencyFormatter = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Formatea un precio en Quetzales, ej. "Q 5,499.00". */
export function formatGTQ(amount: number): string {
  return currencyFormatter.format(amount)
}

/** Formatea un timestamp de captura para mostrar "visto el ...". */
export function formatCapturedAt(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export const CATEGORY_LABELS: Record<string, string> = {
  consolas: 'Consolas',
  gpus: 'Tarjetas gráficas',
  celulares: 'Celulares',
  electrodomesticos: 'Electrodomésticos',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export const STOCK_LABELS: Record<string, string> = {
  in_stock: 'Disponible',
  out_of_stock: 'Agotado',
  unknown: 'Disponibilidad no confirmada',
}

export function stockLabel(status: string): string {
  return STOCK_LABELS[status] ?? status
}
