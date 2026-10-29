// Assistente local (sem serviço externo): entende frases comuns em português por regras e palavras-chave.
// - Roda 100% no aparelho: nenhuma mensagem nem dado financeiro sai do app.
// - Só PROPÕE lançamentos; quem grava é o usuário, ao confirmar na tela.
// - Toda resposta passa por um esquema estrito (nada inválido sai daqui).
import {
  AssistantRequestSchema,
  ModelOutputSchema,
  toReply,
  type AssistantReply,
  type ModelOutput,
} from './contract';
import type { CategoryId, Transaction } from '../types';
import { formatBRL, formatDateBR } from '../utils/format';
import { monthLabel, todayISO } from '../utils/dates';

export interface LocalAssistantContext {
  transactions: readonly Transaction[];
  now?: Date;
}

const CATEGORY_LABELS: Record<CategoryId, string> = {
  moradia: 'Moradia',
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  lazer: 'Lazer',
  saude: 'Saúde',
  assinaturas: 'Assinaturas',
  salario: 'Salário',
  renda_extra: 'Renda extra',
};

const INCOME_CATEGORIES: readonly CategoryId[] = ['salario', 'renda_extra'];

// Palavras-chave (sem acento, minúsculas). Cada item casa por "palavra inteira".
const CATEGORY_KEYWORDS: Record<CategoryId, readonly string[]> = {
  alimentacao: [
    'mercado', 'supermercado', 'padaria', 'restaurante', 'lanche', 'ifood', 'comida', 'almoco', 'jantar',
    'cafe', 'feira', 'acougue', 'hortifruti', 'pizza', 'hamburguer', 'sorvete', 'refeicao', 'marmita', 'bar',
    'cerveja', 'sacolao',
  ],
  transporte: [
    'uber', '99', 'taxi', 'onibus', 'gasolina', 'combustivel', 'estacionamento', 'metro', 'passagem',
    'pedagio', 'etanol', 'diesel', 'mecanico', 'oficina', 'ipva', 'carro', 'moto', 'bilhete',
  ],
  moradia: [
    'aluguel', 'condominio', 'luz', 'energia', 'agua', 'internet', 'gas', 'iptu', 'moradia', 'reforma',
    'telefone', 'celular',
  ],
  lazer: ['cinema', 'show', 'viagem', 'jogo', 'festa', 'parque', 'passeio', 'balada', 'teatro', 'ingresso', 'lazer', 'hotel'],
  saude: [
    'remedio', 'farmacia', 'consulta', 'medico', 'dentista', 'exame', 'plano de saude', 'saude', 'academia',
    'psicologo', 'hospital', 'otica', 'oculos',
  ],
  assinaturas: [
    'netflix', 'spotify', 'streaming', 'assinatura', 'prime', 'disney', 'youtube', 'hbo', 'max', 'deezer',
    'globoplay', 'icloud', 'mensalidade do app',
  ],
  salario: ['salario', 'holerite', 'contracheque', 'pagamento do trabalho', '13o', 'decimo terceiro', 'ferias'],
  renda_extra: [
    'freelance', 'freela', 'bico', 'venda', 'vendi', 'reembolso', 'rendimento', 'dividendo', 'lucro',
    'extra', 'aluguel recebido', 'cashback', 'premio', 'presente em dinheiro',
  ],
};

const INCOME_VERBS = [
  'recebi', 'receber', 'ganhei', 'ganho', 'entrou', 'caiu', 'depositaram', 'deposito', 'vendi', 'reembolsaram',
  'recebimento', 'receita',
];
const EXPENSE_VERBS = [
  'gastei', 'gasto', 'paguei', 'pago', 'pagar', 'comprei', 'compra', 'assinei', 'debitou', 'saiu', 'perdi',
  'custou', 'abasteci', 'despesa', 'conta',
];

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'por', 'para', 'pra', 'pro', 'com', 'meu', 'minha', 'hoje', 'ontem', 'anteontem', 'e', 'ate', 'foi',
  'que', 'eu', 'mais', 'ou', 'dia', 'reais', 'real', 'conto', 'contos', 'pila', 'pilas', 'r$', 'ao', 'aos', 'num', 'numa',
]);

const HELP_TEXT = [
  'Eu consigo:',
  '• Sugerir lançamentos a partir de uma frase, como "gastei 45,90 no mercado hoje" ou "recebi 850 de freelance ontem".',
  '• Responder sobre os seus lançamentos: "quanto gastei este mês?", "qual meu saldo?", "maior gasto", "últimos lançamentos".',
  '• Dar dicas simples de economia: "me dá uma dica".',
  'Tudo é feito no seu aparelho, sem enviar suas mensagens a nenhum serviço. Nada é salvo sem a sua confirmação.',
].join('\n');

// ---------------------------------------------------------------------------
// Utilitários de texto
// ---------------------------------------------------------------------------
function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordIndex(norm: string, word: string): number {
  const m = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}(?![a-z0-9])`).exec(norm);
  return m ? m.index + m[1].length : -1;
}

function firstIndexOf(norm: string, words: readonly string[]): number {
  let best = -1;
  for (const w of words) {
    const i = wordIndex(norm, w);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

function hasWord(norm: string, words: readonly string[]): boolean {
  return firstIndexOf(norm, words) >= 0;
}

// ---------------------------------------------------------------------------
// Datas (fuso do aparelho)
// ---------------------------------------------------------------------------
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function shiftDays(base: Date, days: number): string {
  return todayISO(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

interface ParsedDate {
  iso: string;
  note?: string;
  invalid?: boolean;
}

const FULL_DATE_RE = /(^|[^\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/g;
const DAY_RE = /\bdia\s+(\d{1,2})\b/g;

function parseDate(norm: string, now: Date): ParsedDate {
  const today = todayISO(now);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const slash = [...norm.matchAll(FULL_DATE_RE)];
  const dayWord = [...norm.matchAll(DAY_RE)];
  const relative =
    wordIndex(norm, 'anteontem') >= 0 ? -2 : wordIndex(norm, 'ontem') >= 0 ? -1 : wordIndex(norm, 'hoje') >= 0 ? 0 : null;

  const candidates = slash.length + dayWord.length + (relative !== null ? 1 : 0);
  let result: ParsedDate;

  if (slash.length > 0) {
    const [, , dd, mm, yy] = slash[0];
    let year = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : y;
    const day = Number(dd);
    const month = Number(mm);
    if (!isRealDate(year, month, day)) return { iso: today, invalid: true };
    let note: string | undefined;
    if (!yy && toIso(year, month, day) > today) {
      year -= 1;
      note = 'A data estava no futuro; usei o ano anterior.';
    }
    result = { iso: toIso(year, month, day), note };
  } else if (dayWord.length > 0) {
    const day = Number(dayWord[0][1]);
    let year = y;
    let month = m;
    let note: string | undefined;
    if (day > d) {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      note = `Assumi o dia ${day} do mês anterior (ainda não chegou o dia ${day} deste mês).`;
    }
    if (!isRealDate(year, month, day)) return { iso: today, invalid: true };
    result = { iso: toIso(year, month, day), note };
  } else if (relative !== null) {
    result = { iso: shiftDays(now, relative) };
  } else {
    result = { iso: today };
  }

  if (candidates > 1 && !result.note) result.note = 'Encontrei mais de uma data; usei a primeira.';
  return result;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------
const MONEY_RE = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s*(?:mil|k)\b)?(\s*(?:reais|real|conto|contos|pila|pilas)\b)?/g;

interface Money {
  value: number;
  strong: boolean; // veio com "R$" ou "reais"
}

function stripDates(norm: string): string {
  return norm.replace(FULL_DATE_RE, '$1 ').replace(DAY_RE, ' ');
}

function parseMoneyToken(raw: string, thousand: boolean): number | null {
  let s = raw;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return Math.round((thousand ? v * 1000 : v) * 100) / 100;
}

function extractAmounts(norm: string): Money[] {
  const text = stripDates(norm);
  const out: Money[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const value = parseMoneyToken(m[2], Boolean(m[3]));
    if (value === null) continue;
    out.push({ value, strong: Boolean(m[1] || m[4]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------
function detectCategory(norm: string): CategoryId | null {
  let best: { id: CategoryId; index: number } | null = null;
  (Object.keys(CATEGORY_KEYWORDS) as CategoryId[]).forEach((id) => {
    const i = firstIndexOf(norm, CATEGORY_KEYWORDS[id]);
    if (i >= 0 && (best === null || i < best.index)) best = { id, index: i };
  });
  return best === null ? null : (best as { id: CategoryId; index: number }).id;
}

function detectType(norm: string): { type: 'income' | 'expense' | null; both: boolean } {
  const inc = firstIndexOf(norm, INCOME_VERBS);
  const exp = firstIndexOf(norm, EXPENSE_VERBS);
  if (inc >= 0 && exp >= 0) return { type: inc < exp ? 'income' : 'expense', both: true };
  if (inc >= 0) return { type: 'income', both: false };
  if (exp >= 0) return { type: 'expense', both: false };
  return { type: null, both: false };
}

function buildTitle(original: string, fallback: string): string {
  const cleaned = original.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' ');
  const verbs = new Set([...INCOME_VERBS, ...EXPENSE_VERBS]);
  const kept = cleaned
    .split(/\s+/)
    .filter((tok) => {
      const n = normalize(tok).replace(/^[^\w$]+|[^\w$]+$/g, '');
      if (!n) return false;
      if (STOPWORDS.has(n) || verbs.has(n)) return false;
      if (/^(r\$)?[\d.,]+(mil|k)?$/.test(n)) return false;
      if (/^\d{1,2}\/\d{1,2}(\/\d+)?$/.test(n)) return false;
      return true;
    })
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const joined = kept.join(' ').slice(0, 100).trim();
  const base = joined || fallback;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ---------------------------------------------------------------------------
// Resposta final: sempre validada pelo esquema estrito
// ---------------------------------------------------------------------------
function finish(output: ModelOutput): AssistantReply {
  const checked = ModelOutputSchema.safeParse(output);
  if (!checked.success) {
    return {
      kind: 'clarification',
      question: 'Não consegui montar um lançamento válido. Confira o valor e a data e tente de novo.',
    };
  }
  return toReply(checked.data);
}

const answer = (text: string): AssistantReply => finish({ kind: 'answer', text: text.slice(0, 1000) });
const ask = (question: string): AssistantReply => finish({ kind: 'clarification', question });

// ---------------------------------------------------------------------------
// Lançamento por frase
// ---------------------------------------------------------------------------
function proposeTransaction(message: string, norm: string, now: Date): AssistantReply {
  const amounts = extractAmounts(norm);
  if (amounts.length === 0) {
    return ask('Qual foi o valor? Ex.: "gastei 45,90 no mercado hoje".');
  }

  const date = parseDate(norm, now);
  if (date.invalid) return ask('Essa data não existe. Pode informar de novo (ex.: hoje, ontem, dia 12 ou 12/10)?');

  const ambiguities: string[] = [];
  const distinct = [...new Set(amounts.map((a) => a.value))];
  const chosen = amounts.find((a) => a.strong) ?? amounts[0];
  if (distinct.length > 1) {
    ambiguities.push(`Encontrei mais de um valor (${distinct.map(formatBRL).join(' e ')}); usei ${formatBRL(chosen.value)}.`);
  }
  if (date.note) ambiguities.push(date.note);

  const detected = detectType(norm);
  let category = detectCategory(norm);
  let type = detected.type;

  if (type === null && category !== null) type = INCOME_CATEGORIES.includes(category) ? 'income' : 'expense';
  if (type === null) {
    return ask('Isso foi um gasto ou uma receita? Ex.: "gastei 45,90 no mercado" ou "recebi 850 de freelance".');
  }
  if (detected.both) ambiguities.push('A mensagem tem sinais de receita e de despesa; confira o tipo.');

  if (type === 'income') {
    if (category !== null && !INCOME_CATEGORIES.includes(category)) {
      ambiguities.push(`Receita com a palavra "${CATEGORY_LABELS[category].toLowerCase()}"; usei Renda extra. Confira a categoria.`);
      category = 'renda_extra';
    } else if (category === null) {
      ambiguities.push('Não identifiquei a origem da receita; usei Renda extra. Confira a categoria.');
      category = 'renda_extra';
    }
  } else if (category !== null && INCOME_CATEGORIES.includes(category)) {
    ambiguities.push('Despesa com palavra de receita; usei Lazer. Confira a categoria.');
    category = 'lazer';
  } else if (category === null) {
    ambiguities.push('Não identifiquei a categoria; usei Lazer. Confira antes de salvar.');
    category = 'lazer';
  }

  const confidence = Math.max(0.3, Math.round((0.95 - 0.2 * ambiguities.length) * 100) / 100);

  return finish({
    kind: 'transaction_proposal',
    transaction: {
      title: buildTitle(message, CATEGORY_LABELS[category]),
      category,
      type,
      amount: chosen.value,
      date: date.iso,
    },
    confidence,
    ambiguities: ambiguities.slice(0, 5),
  });
}

// ---------------------------------------------------------------------------
// Perguntas sobre os dados do usuário
// ---------------------------------------------------------------------------
interface Period {
  label: string;
  test(iso: string): boolean;
}

function resolvePeriod(norm: string, now: Date): Period {
  const today = todayISO(now);
  if (wordIndex(norm, 'hoje') >= 0) return { label: 'hoje', test: (d) => d === today };
  if (wordIndex(norm, 'ontem') >= 0) {
    const y = shiftDays(now, -1);
    return { label: 'ontem', test: (d) => d === y };
  }
  if (wordIndex(norm, 'semana') >= 0) {
    const from = shiftDays(now, -6);
    return { label: 'nos últimos 7 dias', test: (d) => d >= from && d <= today };
  }
  if (/mes (passado|anterior)/.test(norm)) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const key = todayISO(prev).slice(0, 7);
    return { label: `em ${monthLabel(key)}`, test: (d) => d.startsWith(key) };
  }
  const key = today.slice(0, 7);
  return { label: `em ${monthLabel(key)}`, test: (d) => d.startsWith(key) };
}

function sum(list: readonly Transaction[]): number {
  return Math.round(list.reduce((s, t) => s + t.amount, 0) * 100) / 100;
}

function topCategory(expenses: readonly Transaction[]): { id: CategoryId; total: number; share: number } | null {
  const total = sum(expenses);
  if (total <= 0) return null;
  const map = new Map<CategoryId, number>();
  expenses.forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
  let best: { id: CategoryId; total: number } | null = null;
  map.forEach((value, id) => {
    if (best === null || value > best.total) best = { id, total: value };
  });
  if (best === null) return null;
  const b = best as { id: CategoryId; total: number };
  return { id: b.id, total: Math.round(b.total * 100) / 100, share: (b.total / total) * 100 };
}

function answerQuestion(norm: string, ctx: LocalAssistantContext, now: Date): AssistantReply {
  const period = resolvePeriod(norm, now);
  const inPeriod = ctx.transactions.filter((t) => period.test(t.date));
  const category = detectCategory(norm);
  const empty = `Você não tem lançamentos ${period.label}.`;

  if (hasWord(norm, ['ultimos', 'ultimo', 'recentes', 'recente'])) {
    const last = [...ctx.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 5);
    if (last.length === 0) return answer('Você ainda não tem lançamentos.');
    return answer(
      ['Seus últimos lançamentos:', ...last.map((t) => `• ${formatDateBR(t.date)} · ${t.title} · ${t.type === 'income' ? '+' : '-'}${formatBRL(t.amount)}`)].join('\n'),
    );
  }

  if (/maior|mais caro|onde (eu )?(mais )?gast/.test(norm)) {
    const expenses = inPeriod.filter((t) => t.type === 'expense');
    if (expenses.length === 0) return answer(`Você não tem despesas ${period.label}.`);
    const top = topCategory(expenses) as NonNullable<ReturnType<typeof topCategory>>;
    const biggest = expenses.reduce((a, b) => (b.amount > a.amount ? b : a));
    return answer(
      `Maior categoria ${period.label}: ${CATEGORY_LABELS[top.id]}, com ${formatBRL(top.total)} (${Math.round(top.share)}% das despesas).\nMaior gasto individual: ${biggest.title}, ${formatBRL(biggest.amount)} em ${formatDateBR(biggest.date)}.`,
    );
  }

  if (hasWord(norm, ['dica', 'dicas', 'economizar', 'poupar', 'economia', 'conselho'])) {
    const month = resolvePeriod('', now);
    const monthTx = ctx.transactions.filter((t) => month.test(t.date));
    const income = sum(monthTx.filter((t) => t.type === 'income'));
    const expenses = monthTx.filter((t) => t.type === 'expense');
    const expense = sum(expenses);
    const lines: string[] = [];
    if (income > 0 && expense > income) {
      lines.push(`Atenção: este mês você gastou ${formatBRL(expense)}, mais do que recebeu (${formatBRL(income)}). Veja o que dá para cortar.`);
    } else if (income > 0) {
      const saved = income - expense;
      lines.push(`Este mês você guardou ${formatBRL(saved)} (${Math.round((saved / income) * 100)}% da receita).`);
    }
    const top = topCategory(expenses);
    if (top && top.share >= 40) {
      lines.push(`${CATEGORY_LABELS[top.id]} pesa ${Math.round(top.share)}% das suas despesas. Vale revisar essa categoria primeiro.`);
    }
    lines.push('Regra simples: 50% para necessidades, 30% para desejos e 20% para guardar ou quitar dívidas.');
    lines.push('Reserve primeiro a parte de guardar, assim que receber, e só depois gaste o resto.');
    return answer(lines.join('\n'));
  }

  if (hasWord(norm, ['saldo', 'sobrou', 'sobra', 'balanco', 'resumo', 'situacao']) || /como (eu )?estou/.test(norm)) {
    if (inPeriod.length === 0) return answer(empty);
    const income = sum(inPeriod.filter((t) => t.type === 'income'));
    const expense = sum(inPeriod.filter((t) => t.type === 'expense'));
    return answer(`Resumo ${period.label}:\n• Receitas: ${formatBRL(income)}\n• Despesas: ${formatBRL(expense)}\n• Saldo: ${formatBRL(income - expense)}`);
  }

  if (hasWord(norm, ['recebi', 'recebo', 'receita', 'receitas', 'ganhei', 'entrou'])) {
    const list = inPeriod.filter((t) => t.type === 'income' && (category === null || t.category === category));
    if (list.length === 0) return answer(`Não encontrei receitas ${period.label}.`);
    return answer(`Você recebeu ${formatBRL(sum(list))} ${period.label} (${list.length} lançamento${list.length > 1 ? 's' : ''}).`);
  }

  if (hasWord(norm, ['gastei', 'gasto', 'gastos', 'despesa', 'despesas', 'paguei', 'gastar'])) {
    const expenses = inPeriod.filter((t) => t.type === 'expense');
    const list = expenses.filter((t) => category === null || t.category === category);
    if (list.length === 0) {
      return answer(category ? `Não encontrei despesas de ${CATEGORY_LABELS[category]} ${period.label}.` : `Não encontrei despesas ${period.label}.`);
    }
    const head = `Você gastou ${formatBRL(sum(list))} ${category ? `com ${CATEGORY_LABELS[category]} ` : ''}${period.label} (${list.length} lançamento${list.length > 1 ? 's' : ''}).`;
    const top = category === null ? topCategory(expenses) : null;
    return answer(top ? `${head}\nMaior categoria: ${CATEGORY_LABELS[top.id]} (${formatBRL(top.total)}).` : head);
  }

  return answer(HELP_TEXT);
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------
const QUESTION_START =
  /^(quanto|quantos|qual|quais|onde|como|me (mostre|mostra|de|da|diga)|mostra|mostre|resumo|saldo|ultimos|ultimo|maior|dica|dicas|posso|tenho|sobrou)\b/;
const GREETING = /^(oi|ola|opa|bom dia|boa tarde|boa noite|ajuda|help|menu|o que (voce )?(faz|sabe)|como funciona|o que posso)\b/;
const MANAGE = /\b(apagar|apague|excluir|exclua|deletar|delete|remover|remova|editar|edite|corrigir|corrija|alterar|altere|mudar|desfazer)\b/;

export function answerLocally(message: string, ctx: LocalAssistantContext): AssistantReply {
  const request = AssistantRequestSchema.safeParse({ message });
  if (!request.success) return ask('Escreva uma mensagem de até 500 caracteres.');

  const now = ctx.now ?? new Date();
  const norm = normalize(request.data.message);

  if (GREETING.test(norm)) return answer(HELP_TEXT);

  if (MANAGE.test(norm)) {
    return answer(
      'Para corrigir ou apagar um lançamento, abra a aba Lançamentos e toque no item. Lá você pode editar os campos ou excluir.',
    );
  }

  const isQuestion = norm.includes('?') || QUESTION_START.test(norm);
  if (isQuestion) return answerQuestion(norm, ctx, now);

  const hasAmount = extractAmounts(norm).length > 0;
  const hasSignal = detectType(norm).type !== null || detectCategory(norm) !== null;
  if (!hasAmount && !hasSignal) return answer(`Não entendi essa mensagem.\n${HELP_TEXT}`);

  return proposeTransaction(request.data.message, norm, now);
}
