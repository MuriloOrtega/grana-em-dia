import { TransactionInputSchema, TransactionPatchSchema } from '../../src/schemas/transaction';
import { CredentialsSchema } from '../../src/schemas/auth';
import { findPossibleDuplicate } from '../../src/services/duplicates';
import { parseAmountBR, parseDateBR } from '../../src/utils/format';
import { validInput } from '../helpers/fakeSupabase';

describe('validação de lançamentos', () => {
  it('aceita um lançamento válido', () => {
    expect(TransactionInputSchema.safeParse(validInput).success).toBe(true);
  });

  it.each([
    ['valor zero', { amount: 0 }],
    ['valor negativo', { amount: -10 }],
    ['valor NaN', { amount: NaN }],
    ['valor infinito', { amount: Infinity }],
    ['mais de 2 casas decimais', { amount: 10.999 }],
    ['valor acima do limite', { amount: 2_000_000_000 }],
    ['valor como texto', { amount: '10' }],
    ['título vazio', { title: '   ' }],
    ['título longo demais', { title: 'a'.repeat(101) }],
    ['título com caractere de controle', { title: 'ab\u0000cd' }],
    ['categoria desconhecida', { category: 'invasao' }],
    ['tipo desconhecido', { type: 'transfer' }],
    ['data inexistente (30/02)', { date: '2026-02-30' }],
    ['data em formato errado', { date: '28/10/2026' }],
    ['receita com categoria de despesa', { type: 'income' }],
    ['despesa com categoria de receita', { category: 'salario' }],
  ])('rejeita %s', (_nome, override) => {
    expect(TransactionInputSchema.safeParse({ ...validInput, ...override }).success).toBe(false);
  });

  it('rejeita user_id e qualquer campo desconhecido enviado pelo cliente', () => {
    expect(TransactionInputSchema.safeParse({ ...validInput, user_id: 'outro-usuario' }).success).toBe(false);
    expect(TransactionInputSchema.safeParse({ ...validInput, id: 'x' }).success).toBe(false);
    expect(TransactionPatchSchema.safeParse({ user_id: 'outro-usuario' }).success).toBe(false);
    expect(TransactionPatchSchema.safeParse({ title: 'ok', user_id: 'outro' }).success).toBe(false);
  });

  it('valida alterações parciais', () => {
    expect(TransactionPatchSchema.safeParse({ title: 'Novo título' }).success).toBe(true);
    expect(TransactionPatchSchema.safeParse({}).success).toBe(false);
    expect(TransactionPatchSchema.safeParse({ amount: -1 }).success).toBe(false);
    expect(TransactionPatchSchema.safeParse({ type: 'income', category: 'alimentacao' }).success).toBe(false);
  });

  it('remove espaços do título', () => {
    const r = TransactionInputSchema.parse({ ...validInput, title: '  Mercado  ' });
    expect(r.title).toBe('Mercado');
  });
});

describe('credenciais', () => {
  it('normaliza e valida e-mail e senha', () => {
    expect(CredentialsSchema.parse({ email: '  USER@Example.com ', password: '12345678' }).email).toBe('user@example.com');
    expect(CredentialsSchema.safeParse({ email: 'invalido', password: '12345678' }).success).toBe(false);
    expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: '1234567' }).success).toBe(false);
    expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(false);
  });
});

describe('entrada de valores e datas', () => {
  it.each([
    ['45,90', 45.9],
    ['1.234,56', 1234.56],
    ['R$ 12,5', 12.5],
    ['45.90', 45.9],
    ['850', 850],
  ])('parseAmountBR(%s)', (texto, esperado) => {
    expect(parseAmountBR(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '--5', '12a'])('parseAmountBR rejeita %p', (texto) => {
    expect(parseAmountBR(texto)).toBeNull();
  });

  it('parseDateBR converte dd/mm/aaaa e rejeita outros formatos', () => {
    expect(parseDateBR('28/10/2026')).toBe('2026-10-28');
    expect(parseDateBR('2026-10-28')).toBeNull();
    expect(parseDateBR('1/1/2026')).toBeNull();
  });
});

describe('detecção de duplicatas', () => {
  const existing = [
    { id: '1', title: 'Mercado', category: 'alimentacao', type: 'expense', amount: 45.9, date: '2026-10-28' },
  ] as const;

  it('encontra lançamento igual (tipo, categoria, data e valor)', () => {
    expect(findPossibleDuplicate(existing, { ...validInput, title: 'Outro nome' })).not.toBeNull();
  });

  it('não acusa duplicata quando valor, data ou categoria diferem', () => {
    expect(findPossibleDuplicate(existing, { ...validInput, amount: 46 })).toBeNull();
    expect(findPossibleDuplicate(existing, { ...validInput, date: '2026-10-27' })).toBeNull();
    expect(findPossibleDuplicate(existing, { ...validInput, category: 'lazer' })).toBeNull();
  });
});
