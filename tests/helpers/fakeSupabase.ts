// Cliente Supabase falso, só o suficiente para exercitar os serviços sem rede.
export interface Result {
  data: unknown;
  error: unknown;
}

export interface Call {
  method: string;
  args: unknown[];
}

export function makeFakeClient(opts: { session: boolean; results?: Result[]; invoke?: () => Promise<unknown> }) {
  const calls: Call[] = [];
  const queue = [...(opts.results ?? [])];

  function builder() {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single']) {
      b[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        return b;
      };
    }
    b.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(resolve, reject);
    return b;
  }

  const client = {
    auth: {
      getSession: async () => ({
        data: { session: opts.session ? { access_token: 'fake-token' } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder();
    },
    functions: {
      invoke: jest.fn(opts.invoke ?? (async () => ({ data: null, error: null }))),
    },
  };

  return { client: client as never, calls, rawClient: client };
}

export const UUID_A = '11111111-1111-4111-8111-111111111111';
export const UUID_B = '22222222-2222-4222-8222-222222222222';

export const validInput = {
  title: 'Supermercado',
  category: 'alimentacao',
  type: 'expense',
  amount: 45.9,
  date: '2026-10-28',
} as const;
