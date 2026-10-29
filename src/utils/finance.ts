import type { CategoryId, Transaction } from '../types';

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryTotal {
  category: CategoryId;
  total: number;
  percent: number; // 0–100, sobre o total de despesas
}

export function getTotals(list: readonly Transaction[]): Totals {
  const income = list.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = list.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export function getExpensesByCategory(list: readonly Transaction[]): CategoryTotal[] {
  const expenses = list.filter((t) => t.type === 'expense');
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);
  const map = new Map<CategoryId, number>();
  expenses.forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));

  return Array.from(map.entries())
    .map(([category, value]) => ({
      category,
      total: value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
