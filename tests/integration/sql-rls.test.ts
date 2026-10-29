// Testa a migração SQL de verdade em um PostgreSQL: RLS, privilégios por coluna, restrições e cota.
// Emula o PostgREST: SET LOCAL ROLE + claim "sub" do JWT. NÃO usa o stack completo do Supabase
// (GoTrue/PostgREST); para isso veja tests/integration/supabase-e2e.test.ts.
// Execução: PG_TEST_URL=postgres://postgres@127.0.0.1:54329/postgres npm run test:sql
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const url = process.env.PG_TEST_URL;
const describeIf = url ? describe : describe.skip;

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REQ = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const tx = (over: Record<string, unknown> = {}) => ({
  request_id: REQ(1),
  title: 'Mercado',
  category: 'alimentacao',
  type: 'expense',
  amount: 45.9,
  date: '2026-10-28',
  ...over,
});

describeIf('migração SQL: RLS e privilégios (PostgreSQL real)', () => {
  let admin: Client;

  async function asRole<T>(role: 'anon' | 'authenticated', sub: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? '']);
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) {
      await c.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      await c.end();
    }
  }

  async function sqlState(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (e) {
      return (e as { code?: string }).code ?? 'sem_codigo';
    }
    return 'sem_erro';
  }

  const insertTx = (c: Client, row: Record<string, unknown>) =>
    c.query(
      `insert into public.transactions (${Object.keys(row).join(',')}) values (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')}) returning *`,
      Object.values(row),
    );

  beforeAll(async () => {
    admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query('drop schema public cascade; create schema public;');
    await admin.query(readFileSync(join(__dirname, '../sql/supabase_stub.sql'), 'utf8'));
    await admin.query(
      readFileSync(join(__dirname, '../../supabase/migrations/20261029000000_security_baseline.sql'), 'utf8'),
    );
    await admin.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [A, 'a@teste.dev', B, 'b@teste.dev']);
  });

  afterAll(async () => {
    await admin.end();
  });

  beforeEach(async () => {
    await admin.query('truncate public.transactions, public.ai_usage_log');
  });

  it('RLS está habilitado e forçado nas duas tabelas', async () => {
    const r = await admin.query(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('transactions','ai_usage_log') and relkind='r'",
    );
    expect(r.rows).toHaveLength(2);
    for (const row of r.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  describe('acesso sem autenticação (anon)', () => {
    it('não lê nem grava lançamentos', async () => {
      expect(await sqlState(asRole('anon', null, (c) => c.query('select * from public.transactions')))).toBe('42501');
      expect(await sqlState(asRole('anon', null, (c) => insertTx(c, tx())))).toBe('42501');
      expect(await sqlState(asRole('anon', null, (c) => c.query('delete from public.transactions')))).toBe('42501');
    });

    it('não executa a função de cota', async () => {
      expect(await sqlState(asRole('anon', null, (c) => c.query('select public.consume_ai_quota()')))).toBe('42501');
    });

    it('mesmo "authenticated" sem usuário (sub vazio) não grava nem lê nada', async () => {
      await asRole('authenticated', A, (c) => insertTx(c, tx()));
      const rows = await asRole('authenticated', null, (c) => c.query('select * from public.transactions'));
      expect(rows.rowCount).toBe(0);
      const state = await sqlState(asRole('authenticated', null, (c) => insertTx(c, tx({ request_id: REQ(2) }))));
      expect(['23502', '42501']).toContain(state);
    });
  });

  describe('isolamento entre dois usuários', () => {
    it('o banco define o dono pela sessão (user_id não é enviado)', async () => {
      const r = await asRole('authenticated', A, (c) => insertTx(c, tx()));
      expect(r.rows[0].user_id).toBe(A);
    });

    it('usuário B não vê os lançamentos de A', async () => {
      await asRole('authenticated', A, (c) => insertTx(c, tx()));
      const asA = await asRole('authenticated', A, (c) => c.query('select id from public.transactions'));
      const asB = await asRole('authenticated', B, (c) => c.query('select id from public.transactions'));
      expect(asA.rowCount).toBe(1);
      expect(asB.rowCount).toBe(0);
    });

    it('B não consegue ler, alterar ou excluir um registro de A, nem mesmo conhecendo o id', async () => {
      const created = await asRole('authenticated', A, (c) => insertTx(c, tx()));
      const id = created.rows[0].id;

      const read = await asRole('authenticated', B, (c) => c.query('select * from public.transactions where id = $1', [id]));
      const upd = await asRole('authenticated', B, (c) =>
        c.query("update public.transactions set title = 'invadido', amount = 1 where id = $1", [id]),
      );
      const del = await asRole('authenticated', B, (c) => c.query('delete from public.transactions where id = $1', [id]));
      expect([read.rowCount, upd.rowCount, del.rowCount]).toEqual([0, 0, 0]);

      const still = await admin.query('select title, amount, user_id from public.transactions where id = $1', [id]);
      expect(still.rows[0]).toMatchObject({ title: 'Mercado', user_id: A });
      expect(Number(still.rows[0].amount)).toBe(45.9);
    });

    it('B não consegue criar registro em nome de A (user_id enviado é recusado)', async () => {
      expect(await sqlState(asRole('authenticated', B, (c) => insertTx(c, tx({ user_id: A }))))).toBe('42501');
      expect(await sqlState(asRole('authenticated', B, (c) => insertTx(c, tx({ user_id: B }))))).toBe('42501');
      expect((await admin.query('select 1 from public.transactions')).rowCount).toBe(0);
    });

    it('o dono não consegue transferir um registro para outro usuário', async () => {
      const created = await asRole('authenticated', A, (c) => insertTx(c, tx()));
      const state = await sqlState(
        asRole('authenticated', A, (c) => c.query('update public.transactions set user_id = $1 where id = $2', [B, created.rows[0].id])),
      );
      expect(state).toBe('42501');
    });

    it('o dono altera e exclui os próprios registros normalmente', async () => {
      const created = await asRole('authenticated', A, (c) => insertTx(c, tx()));
      const id = created.rows[0].id;
      const upd = await asRole('authenticated', A, (c) =>
        c.query("update public.transactions set title = 'Corrigido', amount = 50 where id = $1 returning title, updated_at, created_at", [id]),
      );
      expect(upd.rows[0].title).toBe('Corrigido');
      expect(new Date(upd.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(new Date(upd.rows[0].created_at).getTime());
      const del = await asRole('authenticated', A, (c) => c.query('delete from public.transactions where id = $1', [id]));
      expect(del.rowCount).toBe(1);
    });
  });

  describe('restrições de dados no banco (defesa em profundidade)', () => {
    it.each([
      ['valor negativo', { amount: -1 }],
      ['valor zero', { amount: 0 }],
      ['valor acima do limite', { amount: 2_000_000_000 }],
      ['título vazio', { title: '   ' }],
      ['categoria fora da lista', { category: 'cripto' }],
      ['tipo fora da lista', { type: 'transfer' }],
      ['receita com categoria de despesa', { type: 'income' }],
      ['despesa com categoria de receita', { category: 'salario' }],
    ])('recusa %s', async (_n, over) => {
      const state = await sqlState(asRole('authenticated', A, (c) => insertTx(c, tx(over))));
      expect(['23514', '22003']).toContain(state);
    });

    it('chave de idempotência: repetir request_id não duplica; usuários diferentes podem reutilizar', async () => {
      await asRole('authenticated', A, (c) => insertTx(c, tx()));
      expect(await sqlState(asRole('authenticated', A, (c) => insertTx(c, tx())))).toBe('23505');
      expect(await sqlState(asRole('authenticated', B, (c) => insertTx(c, tx())))).toBe('sem_erro');
    });
  });

  describe('cota de uso do assistente', () => {
    it('a tabela de registro é inacessível ao cliente', async () => {
      expect(await sqlState(asRole('authenticated', A, (c) => c.query('select * from public.ai_usage_log')))).toBe('42501');
      expect(await sqlState(asRole('authenticated', A, (c) => c.query('delete from public.ai_usage_log')))).toBe('42501');
      expect(await sqlState(asRole('authenticated', A, (c) => c.query('insert into public.ai_usage_log (user_id) values ($1)', [A])))).toBe('42501');
    });

    it('limita a 20 chamadas por hora por usuário, sem afetar outro usuário', async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 21; i += 1) {
        const r = await asRole('authenticated', A, (c) => c.query('select public.consume_ai_quota() as ok'));
        results.push(r.rows[0].ok);
      }
      expect(results.slice(0, 20).every(Boolean)).toBe(true);
      expect(results[20]).toBe(false);

      const b = await asRole('authenticated', B, (c) => c.query('select public.consume_ai_quota() as ok'));
      expect(b.rows[0].ok).toBe(true);
    });

    it('sem usuário identificado a cota é negada', async () => {
      const r = await asRole('authenticated', null, (c) => c.query('select public.consume_ai_quota() as ok'));
      expect(r.rows[0].ok).toBe(false);
    });

    it('uma chamada de A nunca consome a cota de B', async () => {
      await asRole('authenticated', A, (c) => c.query('select public.consume_ai_quota()'));
      const counts = await admin.query('select user_id, count(*)::int as n from public.ai_usage_log group by user_id');
      expect(counts.rows).toEqual([{ user_id: A, n: 1 }]);
    });
  });
});
