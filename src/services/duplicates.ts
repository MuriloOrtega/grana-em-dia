import type { Transaction } from '../types';
import type { TransactionInput } from '../schemas/transaction';

/** Mesmo tipo, categoria, data e valor (em centavos) indica possível duplicata. */
export function findPossibleDuplicate(
  existing: readonly Transaction[],
  candidate: TransactionInput,
): Transaction | null {
  const cents = Math.round(candidate.amount * 100);
  return (
    existing.find(
      (t) =>
        t.type === candidate.type &&
        t.category === candidate.category &&
        t.date === candidate.date &&
        Math.round(t.amount * 100) === cents,
    ) ?? null
  );
}
