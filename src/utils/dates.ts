const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "AAAA-MM" do mês atual (fuso do aparelho). */
export function currentMonthKey(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTHS[month - 1]} de ${year}`;
}

export function isInMonth(isoDate: string, monthKey: string): boolean {
  return isoDate.startsWith(monthKey);
}
