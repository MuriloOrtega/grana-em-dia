// Formatação manual para não depender de Intl (comportamento igual em Android e iOS).

export function formatBRL(value: number): string {
  const abs = Math.abs(value);
  const [integerPart, decimalPart] = abs.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';
  return `${sign}R$ ${withThousands},${decimalPart}`;
}

export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Converte "1.234,56", "12,5", "R$ 45" ou "45.90" em número; null se inválido. */
export function parseAmountBR(text: string): number | null {
  const cleaned = text.replace(/R\$|\s/g, '');
  if (!/^[\d.,]+$/.test(cleaned)) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Converte "dd/mm/aaaa" em "aaaa-mm-dd" (a validade real da data é checada pelo esquema). */
export function parseDateBR(text: string): string | null {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
