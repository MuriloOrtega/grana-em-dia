import { createTransactionsRepository } from '../../src/services/transactions';
import { AppError } from '../../src/services/errors';
import { makeFakeClient, UUID_A, UUID_B, validInput } from '../helpers/fakeSupabase';

const ROW = { id: UUID_A, title: 'Supermercado', category: 'alimentacao', type: 'expense', amount: 45.9, date: '2026-10-28' };

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as AppError).code;
  }
  return 'no_error';
}

describe('acesso sem autenticação', () => {
  it('nenhuma operação chega à rede quando não há sessão', async () => {
    const { client, calls } = makeFakeClient({ session: false });
    const repo = createTransactionsRepository(client);

    expect(await codeOf(repo.list())).toBe('unauthenticated');
    expect(await codeOf(repo.create(validInput, UUID_B))).toBe('unauthenticated');
    expect(await codeOf(repo.update(UUID_A, { title: 'x' }))).toBe('unauthenticated');
    expect(await codeOf(repo.remove(UUID_A))).toBe('unauthenticated');
    expect(calls.filter((c) => c.method === 'from')).toHaveLength(0);
  });
});

describe('validação antes de tocar a rede', () => {
  it('rejeita user_id enviado pelo cliente (não confia no cliente)', async () => {
    const { client, calls } = makeFakeClient({ session: true });
    const repo = createTransactionsRepository(client);
    expect(await codeOf(repo.create({ ...validInput, user_id: 'outro-usuario' }, UUID_B))).toBe('validation');
    expect(await codeOf(repo.update(UUID_A, { user_id: 'outro-usuario' }))).toBe('validation');
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['valor negativo', { ...validInput, amount: -5 }],
    ['data inválida', { ...validInput, date: '2026-02-30' }],
    ['categoria inválida', { ...validInput, category: 'hack' }],
    ['título vazio', { ...validInput, title: '' }],
  ])('create rejeita %s sem chamar o banco', async (_n, input) => {
    const { client, calls } = makeFakeClient({ session: true });
    const repo = createTransactionsRepository(client);
    expect(await codeOf(repo.create(input, UUID_B))).toBe('validation');
    expect(calls).toHaveLength(0);
  });

  it('rejeita ids e chaves de idempotência que não são UUID', async () => {
    const { client, calls } = makeFakeClient({ session: true });
    const repo = createTransactionsRepository(client);
    expect(await codeOf(repo.create(validInput, 'nao-e-uuid'))).toBe('validation');
    expect(await codeOf(repo.update('1; drop table', { title: 'x' }))).toBe('validation');
    expect(await codeOf(repo.remove('abc'))).toBe('validation');
    expect(calls).toHaveLength(0);
  });
});

describe('operações autenticadas', () => {
  it('create envia apenas os campos permitidos e nunca user_id', async () => {
    const { client, calls } = makeFakeClient({ session: true, results: [{ data: ROW, error: null }] });
    const repo = createTransactionsRepository(client);
    const created = await repo.create(validInput, UUID_B);

    const insert = calls.find((c) => c.method === 'insert');
    const payload = insert?.args[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['amount', 'category', 'date', 'request_id', 'title', 'type']);
    expect(payload).not.toHaveProperty('user_id');
    expect(created.id).toBe(UUID_A);
  });

  it('select não pede user_id', async () => {
    const { client, calls } = makeFakeClient({ session: true, results: [{ data: [ROW], error: null }] });
    await createTransactionsRepository(client).list();
    const select = calls.find((c) => c.method === 'select');
    expect(String(select?.args[0])).not.toContain('user_id');
  });

  it('create é idempotente: repetir a mesma confirmação devolve o registro existente', async () => {
    const { client } = makeFakeClient({
      session: true,
      results: [
        { data: null, error: { code: '23505', message: 'duplicate key' } },
        { data: ROW, error: null },
      ],
    });
    const created = await createTransactionsRepository(client).create(validInput, UUID_B);
    expect(created.id).toBe(UUID_A);
  });

  it('update e remove de registro de outro usuário (RLS devolve 0 linhas) viram not_found', async () => {
    const upd = makeFakeClient({ session: true, results: [{ data: null, error: { code: 'PGRST116', message: 'no rows' } }] });
    expect(await codeOf(createTransactionsRepository(upd.client).update(UUID_A, { title: 'x' }))).toBe('not_found');

    const del = makeFakeClient({ session: true, results: [{ data: [], error: null }] });
    expect(await codeOf(createTransactionsRepository(del.client).remove(UUID_A))).toBe('not_found');
  });

  it('list rejeita linhas fora do esquema em vez de exibir dados incorretos', async () => {
    const { client } = makeFakeClient({ session: true, results: [{ data: [{ ...ROW, amount: -1 }], error: null }] });
    expect(await codeOf(createTransactionsRepository(client).list())).toBe('unknown');
  });
});

describe('tratamento de erros sem vazar detalhes internos', () => {
  it('não repassa a mensagem do servidor/banco', async () => {
    const leak = 'relation "public.transactions" does not exist; SECRET_INTERNAL host=10.0.0.5';
    const { client } = makeFakeClient({ session: true, results: [{ data: null, error: { code: 'XX000', message: leak } }] });
    try {
      await createTransactionsRepository(client).list();
      throw new Error('deveria falhar');
    } catch (e) {
      expect((e as Error).message).not.toContain('SECRET_INTERNAL');
      expect((e as Error).message).not.toContain('public.transactions');
      expect((e as AppError).code).toBe('unknown');
    }
  });

  it.each([
    [{ status: 401, message: 'x' }, 'unauthenticated'],
    [{ code: 'PGRST301', message: 'x' }, 'unauthenticated'],
    [{ code: 'PGRST303', message: 'JWT expired' }, 'unauthenticated'],
    [{ message: 'JWT expired' }, 'unauthenticated'],
    [{ code: '42501', message: 'row-level security' }, 'forbidden'],
    [{ code: '23514', message: 'check' }, 'validation'],
  ])('mapeia %j para %s', async (error, esperado) => {
    const { client } = makeFakeClient({ session: true, results: [{ data: null, error }] });
    expect(await codeOf(createTransactionsRepository(client).list())).toBe(esperado);
  });

  it('falha de rede vira erro de conexão genérico', async () => {
    const { client, rawClient } = makeFakeClient({ session: true });
    rawClient.from = () => {
      throw new TypeError('Network request failed: https://segredo.supabase.co');
    };
    try {
      await createTransactionsRepository(client).list();
      throw new Error('deveria falhar');
    } catch (e) {
      expect((e as AppError).code).toBe('network');
      expect((e as Error).message).not.toContain('segredo');
    }
  });
});
