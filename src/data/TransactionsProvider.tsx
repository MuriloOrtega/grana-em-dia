// Estado dos lançamentos carregados do Supabase. Todas as operações passam pelo repositório validado.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSupabase } from '../lib/supabase';
import type { TransactionInput } from '../schemas/transaction';
import { AppError, toAppError } from '../services/errors';
import { createTransactionsRepository } from '../services/transactions';
import type { Transaction } from '../types';

export type OpResult = { ok: true } | { ok: false; message: string };

interface TransactionsContextValue {
  items: Transaction[];
  status: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  refresh(): Promise<void>;
  add(input: TransactionInput, requestId: string): Promise<OpResult>;
  update(id: string, patch: Partial<TransactionInput>): Promise<OpResult>;
  remove(id: string): Promise<OpResult>;
}

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session, expireSession } = useAuth();
  const userId = session?.user.id ?? null;
  const repo = useMemo(() => createTransactionsRepository(getSupabase()), []);

  const [items, setItems] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fail = useCallback(
    async (e: unknown): Promise<{ ok: false; message: string }> => {
      const err = toAppError(e);
      if (err.code === 'unauthenticated') await expireSession();
      return { ok: false, message: err.message };
    },
    [expireSession],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    try {
      setItems(await repo.list());
      setErrorMessage(null);
      setStatus('ready');
    } catch (e) {
      const result = await fail(e);
      setErrorMessage(result.message);
      setStatus('error');
    }
  }, [repo, fail]);

  // Recarrega ao trocar de usuário e limpa os dados do usuário anterior da memória.
  useEffect(() => {
    setItems([]);
    if (userId) void refresh();
  }, [userId, refresh]);

  const add = useCallback(
    async (input: TransactionInput, requestId: string): Promise<OpResult> => {
      try {
        const created = await repo.create(input, requestId);
        setItems((prev) => (prev.some((t) => t.id === created.id) ? prev : [created, ...prev]));
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
    [repo, fail],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TransactionInput>): Promise<OpResult> => {
      try {
        const updated = await repo.update(id, patch);
        setItems((prev) => prev.map((t) => (t.id === id ? updated : t)));
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
    [repo, fail],
  );

  const remove = useCallback(
    async (id: string): Promise<OpResult> => {
      try {
        await repo.remove(id);
        setItems((prev) => prev.filter((t) => t.id !== id));
        return { ok: true };
      } catch (e) {
        if (e instanceof AppError && e.code === 'not_found') {
          setItems((prev) => prev.filter((t) => t.id !== id));
        }
        return fail(e);
      }
    },
    [repo, fail],
  );

  const value = useMemo<TransactionsContextValue>(
    () => ({ items, status, errorMessage, refresh, add, update, remove }),
    [items, status, errorMessage, refresh, add, update, remove],
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactions(): TransactionsContextValue {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useTransactions deve ser usado dentro de TransactionsProvider');
  return ctx;
}
