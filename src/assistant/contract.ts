// Esquemas de validação de lançamentos e do contrato de respostas do assistente.
// Sem dependências de plataforma; importa apenas "zod".
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------
export const CATEGORY_IDS = [
  'moradia',
  'alimentacao',
  'transporte',
  'lazer',
  'saude',
  'assinaturas',
  'salario',
  'renda_extra',
] as const;

export const INCOME_CATEGORY_IDS = ['salario', 'renda_extra'] as const;
export const TRANSACTION_TYPES = ['income', 'expense'] as const;

export const MAX_AMOUNT = 1_000_000_000;

function isRealDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

// Caracteres de controle (exceto espaço) não são aceitos em textos livres.
const NO_CONTROL_CHARS = /^[^\u0000-\u001F\u007F]*$/;

export const TitleSchema = z
  .string()
  .trim()
  .min(1, 'title_required')
  .max(100, 'title_too_long')
  .regex(NO_CONTROL_CHARS, 'title_invalid_chars');

export const AmountSchema = z
  .number()
  .finite()
  .positive('amount_must_be_positive')
  .max(MAX_AMOUNT, 'amount_too_large')
  .refine(hasAtMostTwoDecimals, 'amount_decimals');

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_format')
  .refine(isRealDate, 'date_invalid');

// Objeto estrito: campos desconhecidos (como user_id) são REJEITADOS, não ignorados.
export const TransactionObjectSchema = z
  .object({
    title: TitleSchema,
    category: z.enum(CATEGORY_IDS),
    type: z.enum(TRANSACTION_TYPES),
    amount: AmountSchema,
    date: IsoDateSchema,
  })
  .strict();

function typeMatchesCategory(t: { type: string; category: string }): boolean {
  const isIncomeCategory = (INCOME_CATEGORY_IDS as readonly string[]).includes(t.category);
  return (t.type === 'income') === isIncomeCategory;
}

export const TransactionInputSchema = TransactionObjectSchema.refine(typeMatchesCategory, {
  message: 'type_category_mismatch',
  path: ['category'],
});

export const TransactionPatchSchema = TransactionObjectSchema.partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, { message: 'empty_patch' })
  .refine((p) => p.type === undefined || p.category === undefined || typeMatchesCategory({ type: p.type, category: p.category }), {
    message: 'type_category_mismatch',
    path: ['category'],
  });

export type TransactionInputData = z.infer<typeof TransactionInputSchema>;

// ---------------------------------------------------------------------------
// Contrato do assistente
// ---------------------------------------------------------------------------
export const MAX_USER_MESSAGE_CHARS = 500;
export const MIN_CONFIDENCE_TO_SKIP_REVIEW = 0.8;

export const AssistantRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(MAX_USER_MESSAGE_CHARS),
  })
  .strict();

const ProposalCore = {
  kind: z.literal('transaction_proposal'),
  transaction: TransactionInputSchema,
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(200)).max(5),
};

const ClarificationCore = {
  kind: z.literal('clarification'),
  question: z.string().trim().min(1).max(300),
};

const AnswerCore = {
  kind: z.literal('answer'),
  text: z.string().trim().min(1).max(1000),
};

// Formas aceitas de resposta do assistente. Qualquer outra é descartada.
export const ModelOutputSchema = z.discriminatedUnion('kind', [
  z.object(ProposalCore).strict(),
  z.object(ClarificationCore).strict(),
  z.object(AnswerCore).strict(),
]);

// Resposta final entregue à tela. A confirmação do usuário é sempre exigida.
export const AssistantReplySchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...ProposalCore,
      requires_confirmation: z.literal(true),
      needs_clarification: z.boolean(),
    })
    .strict(),
  z.object(ClarificationCore).strict(),
  z.object(AnswerCore).strict(),
]);

export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type AssistantReply = z.infer<typeof AssistantReplySchema>;

export function toReply(output: ModelOutput): AssistantReply {
  if (output.kind === 'transaction_proposal') {
    return {
      ...output,
      requires_confirmation: true,
      needs_clarification:
        output.confidence < MIN_CONFIDENCE_TO_SKIP_REVIEW || output.ambiguities.length > 0,
    };
  }
  return output;
}

