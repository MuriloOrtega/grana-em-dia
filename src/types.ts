import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type TransactionType = 'income' | 'expense';

export type CategoryId =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'lazer'
  | 'saude'
  | 'assinaturas'
  | 'salario'
  | 'renda_extra';

export interface CategoryInfo {
  label: string;
  icon: IconName;
  color: string;
}

export interface Transaction {
  id: string;
  title: string;
  category: CategoryId;
  type: TransactionType;
  amount: number; // sempre positivo; o sinal vem de "type"
  date: string; // AAAA-MM-DD
}

export interface Goal {
  id: string;
  name: string;
  icon: IconName;
  target: number;
  saved: number;
}

export interface ProposalState {
  requestId: string; // chave de idempotência: confirmar duas vezes não duplica
  transaction: {
    title: string;
    category: CategoryId;
    type: TransactionType;
    amount: number;
    date: string;
  };
  ambiguities: string[];
  needsClarification: boolean;
  duplicateOf: Transaction | null;
  status: 'pending' | 'saved' | 'discarded';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  proposal?: ProposalState;
}

export type RootTabParamList = {
  Inicio: undefined;
  Assistente: undefined;
  Lancamentos: undefined;
  Relatorios: undefined;
  Metas: undefined;
  Perfil: undefined;
};
