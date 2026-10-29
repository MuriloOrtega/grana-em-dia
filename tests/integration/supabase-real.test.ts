// Teste de segurança contra o Supabase REAL, com DOIS usuários de teste já existentes.
// Usa apenas URL + chave publicável (a mesma do app). Nunca use service_role aqui.
// Fica pulado quando as variáveis não estão definidas.
//
// PowerShell (valores só nesta janela; não coloque em arquivos nem no chat):
//   $env:E2E_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
//   $env:E2E_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
//   $env:E2E_USER_A_EMAIL="..."; $env:E2E_USER_A_PASSWORD="..."
//   $env:E2E_USER_B_EMAIL="..."; $env:E2E_USER_B_PASSWORD="..."
//   npm.cmd run test:real
//
// Os dois usuários devem ser criados no painel (Authentication > Users > Add user, com auto-confirm).
// O teste apaga os lançamentos que cria.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createTransactionsRepository } from '../../src/services/transactions';
import { UUID_A, validInput } from '../helpers/fakeSupabase';

const env = process.env;
const ready =
  env.E2E_SUPABASE_URL &&
  env.E2E_SUPABASE_PUBLISHABLE_KEY &&
  env.E2E_USER_A_EMAIL &&
  env.E2E_USER_A_PASSWORD &&
  env.E2E_USER_B_EMAIL &&
  env.E2E_USER_B_PASSWORD;
const describeIf = ready ? describe : describe.skip;

const url = env.E2E_SUPABASE_URL as string;
const key = env.E2E_SUPABASE_PUBLISHABLE_KEY as string;

const newClient = (): SupabaseClient =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = newClient();
  const res = await client.auth.signInWithPassword({ email, password });
  if (res.error || !res.data.user) throw new Error('Login do usuário de teste falhou (e-mail confirmado? senha correta?)');
  return { client, userId: res.data.user.id };
}

const run = String(Date.now() % 1e9).padStart(9, '0');
const rid = (n: number): string => `00000000-0000-4000-8000-${run}${String(n).padStart(3, '0')}`;

describeIf('Supabase real: isolamento entre dois usuários e acesso sem login', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let idA = '';
  let idB = '';
  let anon: SupabaseClient;
  const created: Array<{ owner: 'a' | 'b'; id: string }> = [];

  beforeAll(async () => {
    const ua = await login(env.E2E_USER_A_EMAIL as string, env.E2E_USER_A_PASSWORD as string);
    const ub = await login(env.E2E_USER_B_EMAIL as string, env.E2E_USER_B_PASSWORD as string);
    a = ua.client;
    b = ub.client;
    idA = ua.userId;
    idB = ub.userId;
    anon = newClient();
    if (idA === idB) throw new Error('Os usuários A e B precisam ser contas diferentes.');
  });

  afterAll(async () => {
    for (const c of created) {
      await createTransactionsRepository(c.owner === 'a' ? a : b)
        .remove(c.id)
        .catch(() => undefined);
    }
  });

  it('sem login: não lê, não grava e não consome cota', async () => {
    const sel = await anon.from('transactions').select('id');
    expect(sel.error !== null || (sel.data ?? []).length === 0).toBe(true);
    const ins = await anon.from('transactions').insert({ request_id: rid(1), ...validInput });
    expect(ins.error).not.toBeNull();
    const quota = await anon.rpc('consume_ai_quota');
    expect(quota.error).not.toBeNull();
  });

  it('usuário B não lê, altera nem exclui lançamentos do usuário A', async () => {
    const repoA = createTransactionsRepository(a);
    const repoB = createTransactionsRepository(b);
    const row = await repoA.create(validInput, rid(2));
    created.push({ owner: 'a', id: row.id });

    expect((await repoB.list()).some((t) => t.id === row.id)).toBe(false);
    await expect(repoB.update(row.id, { title: 'invadido' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(repoB.remove(row.id)).rejects.toMatchObject({ code: 'not_found' });

    const still = (await repoA.list()).find((t) => t.id === row.id);
    expect(still?.title).toBe(validInput.title);
  });

  it('cada usuário vê somente os próprios lançamentos', async () => {
    const repoA = createTransactionsRepository(a);
    const repoB = createTransactionsRepository(b);
    const ra = await repoA.create({ ...validInput, title: 'so do A' }, rid(3));
    const rb = await repoB.create({ ...validInput, title: 'so do B' }, rid(4));
    created.push({ owner: 'a', id: ra.id }, { owner: 'b', id: rb.id });

    const listA = await repoA.list();
    const listB = await repoB.list();
    expect(listA.some((t) => t.id === rb.id)).toBe(false);
    expect(listB.some((t) => t.id === ra.id)).toBe(false);
  });

  it('o banco define o dono: user_id enviado pelo cliente é recusado', async () => {
    const res = await a.from('transactions').insert({ user_id: idB, request_id: rid(5), ...validInput });
    expect(res.error).not.toBeNull();
  });

  it('o dono não consegue trocar user_id de um lançamento existente', async () => {
    const repoA = createTransactionsRepository(a);
    const row = await repoA.create(validInput, rid(6));
    created.push({ owner: 'a', id: row.id });
    const res = await a.from('transactions').update({ user_id: idB }).eq('id', row.id);
    expect(res.error).not.toBeNull();
  });

  it('repetir a mesma confirmação (mesmo request_id) não duplica', async () => {
    const repoA = createTransactionsRepository(a);
    const first = await repoA.create(validInput, rid(7));
    created.push({ owner: 'a', id: first.id });
    const second = await repoA.create(validInput, rid(7));
    expect(second.id).toBe(first.id);
    expect((await repoA.list()).filter((t) => t.id === first.id)).toHaveLength(1);
  });

  it.each([
    ['valor negativo', { amount: -5 }],
    ['valor zero', { amount: 0 }],
    ['receita com categoria de despesa', { type: 'income' }],
    ['categoria inexistente', { category: 'invasao' }],
    ['tipo inexistente', { type: 'transfer' }],
    ['título vazio', { title: '   ' }],
  ])('o banco recusa dado inválido mesmo sem passar pelo app: %s', async (_nome, override) => {
    const res = await a.from('transactions').insert({ request_id: rid(8), ...validInput, ...override });
    expect(res.error).not.toBeNull();
  });

  it('a tabela de uso do assistente é inacessível ao cliente, mas a cota funciona para usuário logado', async () => {
    const direct = await a.from('ai_usage_log').select('*');
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);
    const insertDirect = await a.from('ai_usage_log').insert({ user_id: idA });
    expect(insertDirect.error).not.toBeNull();
    const quota = await a.rpc('consume_ai_quota');
    expect(quota.error).toBeNull();
    expect(quota.data).toBe(true);
  });

  it('id inexistente não vaza detalhes', async () => {
    await expect(createTransactionsRepository(a).remove(UUID_A)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('depois do logout a sessão não acessa mais os dados', async () => {
    const { client } = await login(env.E2E_USER_A_EMAIL as string, env.E2E_USER_A_PASSWORD as string);
    await client.auth.signOut();
    const res = await client.from('transactions').select('id');
    expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
  });

  it('senha errada falha sem revelar se o e-mail existe', async () => {
    const res = await newClient().auth.signInWithPassword({
      email: env.E2E_USER_A_EMAIL as string,
      password: 'senha-errada-qualquer-123',
    });
    expect(res.error).not.toBeNull();
    expect(res.data.session).toBeNull();
  });
});
