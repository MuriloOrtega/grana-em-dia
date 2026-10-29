// Módulo centralizado de acesso aos lançamentos.
// Regras:
//  - toda entrada é validada com Zod antes de tocar a rede;
//  - NUNCA envia user_id: o banco define o dono por auth.uid() e o RLS valida a propriedade;
//  - sem sessão, nenhuma operação é tentada;
//  - erros são convertidos em AppError (mensagens genéricas).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from '../types';
import { TransactionInputSchema, TransactionPatchSchema, TransactionRowSchema, UuidSchema } from '../schemas/transaction';
import { AppError, toAppError } from './errors';

const COLUMNS = 'id,title,category,type,amount,date';
const LIST_LIMIT = 500;

export interface TransactionsRepository {
  list(): Promise<Transaction[]>;
  create(input: unknown, requestId: string): Promise<Transaction>;
  update(id: string, patch: unknown): Promise<Transaction>;
  remove(id: string): Promise<void>;
}

function toTransaction(row: unknown): Transaction {
  const parsed = TransactionRowSchema.safeParse(row);
  if (!parsed.success) throw new AppError('unknown');
  return parsed.data;
}

export function createTransactionsRepository(client: SupabaseClient): TransactionsRepository {
  async function requireSession(): Promise<void> {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new AppError('unauthenticated');
  }

  return {
    async list() {
      try {
        await requireSession();
        const { data, error } = await client
          .from('transactions')
          .select(COLUMNS)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(LIST_LIMIT);
        if (error) throw error;
        return (data ?? []).map(toTransaction);
      } catch (e) {
        throw toAppError(e);
      }
    },

    async create(input, requestId) {
      const parsed = TransactionInputSchema.safeParse(input);
      const id = UuidSchema.safeParse(requestId);
      if (!parsed.success || !id.success) throw new AppError('validation');
      try {
        await requireSession();
        const { data, error } = await client
          .from('transactions')
          .insert({ request_id: id.data, ...parsed.data })
          .select(COLUMNS)
          .single();
        if (error) {
          // Repetição da mesma confirmação (duplo toque, nova tentativa): devolve o registro já criado.
          if (error.code === '23505') {
            const existing = await client
              .from('transactions')
              .select(COLUMNS)
              .eq('request_id', id.data)
              .single();
            if (!existing.error && existing.data) return toTransaction(existing.data);
          }
          throw error;
        }
        return toTransaction(data);
      } catch (e) {
        throw toAppError(e);
      }
    },

    async update(id, patch) {
      const parsedId = UuidSchema.safeParse(id);
      const parsed = TransactionPatchSchema.safeParse(patch);
      if (!parsedId.success || !parsed.success) throw new AppError('validation');
      try {
        await requireSession();
        const { data, error } = await client
          .from('transactions')
          .update(parsed.data)
          .eq('id', parsedId.data)
          .select(COLUMNS)
          .single();
        if (error) throw error;
        return toTransaction(data);
      } catch (e) {
        throw toAppError(e);
      }
    },

    async remove(id) {
      const parsedId = UuidSchema.safeParse(id);
      if (!parsedId.success) throw new AppError('validation');
      try {
        await requireSession();
        const { data, error } = await client
          .from('transactions')
          .delete()
          .eq('id', parsedId.data)
          .select('id');
        if (error) throw error;
        // RLS esconde registros de outros usuários: nenhuma linha afetada = não encontrado.
        if (!data || data.length === 0) throw new AppError('not_found');
      } catch (e) {
        throw toAppError(e);
      }
    },
  };
}
