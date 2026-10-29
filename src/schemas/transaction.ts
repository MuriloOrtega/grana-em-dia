// Validação de lançamentos: esquemas compartilhados com o assistente.
import { z } from 'zod';
import {
  CATEGORY_IDS,
  INCOME_CATEGORY_IDS,
  TransactionInputSchema,
  TransactionPatchSchema,
  type TransactionInputData,
} from '../assistant/contract';

export { CATEGORY_IDS, INCOME_CATEGORY_IDS, TransactionInputSchema, TransactionPatchSchema };
export type TransactionInput = TransactionInputData;

export const UuidSchema = z.string().uuid();

// Linha devolvida pelo banco. Campos extras são descartados; user_id nem é selecionado.
export const TransactionRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: z.enum(CATEGORY_IDS),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((d) => d.slice(0, 10)),
});
