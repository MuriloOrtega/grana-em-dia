import type { CategoryId, CategoryInfo, Goal } from '../types';

// Orçamento e metas ainda são demonstrativos (não persistidos). Lançamentos vêm do Supabase.
export const MONTHLY_BUDGET = 3500;

export const categories: Record<CategoryId, CategoryInfo> = {
  moradia: { label: 'Moradia', icon: 'home-outline', color: '#17803F' },
  alimentacao: { label: 'Alimentação', icon: 'restaurant-outline', color: '#C77700' },
  transporte: { label: 'Transporte', icon: 'bus-outline', color: '#2563A8' },
  lazer: { label: 'Lazer', icon: 'game-controller-outline', color: '#8A3FA8' },
  saude: { label: 'Saúde', icon: 'medkit-outline', color: '#B83227' },
  assinaturas: { label: 'Assinaturas', icon: 'tv-outline', color: '#4F6F5A' },
  salario: { label: 'Salário', icon: 'cash-outline', color: '#17803F' },
  renda_extra: { label: 'Renda extra', icon: 'briefcase-outline', color: '#0F766E' },
};

export const goals: Goal[] = [
  { id: 'g1', name: 'Reserva de emergência', icon: 'shield-checkmark-outline', target: 15000, saved: 6300 },
  { id: 'g2', name: 'Viagem de fim de ano', icon: 'airplane-outline', target: 4000, saved: 2800 },
  { id: 'g3', name: 'Notebook novo', icon: 'laptop-outline', target: 5500, saved: 900 },
];

// Exemplos de mensagens para o assistente propor lançamentos.
export const suggestedMessages: string[] = [
  'Gastei 45,90 no mercado hoje',
  'Recebi 850 de freelance ontem',
  'Paguei 79,90 de streaming dia 12',
  'Comprei remédio por 32 reais',
  'Quanto gastei este mês?',
  'Qual meu saldo?',
  'Qual meu maior gasto?',
];
