// Formulário de lançamento (novo, edição ou revisão de uma proposta do assistente).
// A validação usa o mesmo esquema do servidor; mensagens de erro são genéricas e por campo.
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categories } from '../data/mock';
import { CATEGORY_IDS, INCOME_CATEGORY_IDS, TransactionInputSchema, type TransactionInput } from '../schemas/transaction';
import { colors, radius, spacing } from '../theme';
import type { CategoryId, TransactionType } from '../types';
import { formatDateBR, parseAmountBR, parseDateBR } from '../utils/format';
import { todayISO } from '../utils/dates';

export interface TransactionDraft {
  title: string;
  category: CategoryId;
  type: TransactionType;
  amount: number;
  date: string;
}

interface Props {
  visible: boolean;
  heading: string;
  submitLabel: string;
  initial?: TransactionDraft;
  /** Retorna uma mensagem de erro para exibir, ou null em caso de sucesso (o modal fecha). */
  onSubmit(input: TransactionInput): Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  onClose(): void;
}

const FIELD_MESSAGES: Record<string, string> = {
  title: 'Informe um título de até 100 caracteres.',
  amount: 'Informe um valor positivo, com até 2 casas decimais.',
  date: 'Informe uma data válida no formato dd/mm/aaaa.',
  category: 'Escolha uma categoria compatível com o tipo.',
  type: 'Escolha receita ou despesa.',
};

const isIncomeCategory = (c: CategoryId): boolean => (INCOME_CATEGORY_IDS as readonly string[]).includes(c);

export default function TransactionFormModal({
  visible,
  heading,
  submitLabel,
  initial,
  onSubmit,
  onDelete,
  onClose,
}: Props): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dateText, setDateText] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<CategoryId>('alimentacao');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setAmountText(initial ? String(initial.amount).replace('.', ',') : '');
    setDateText(formatDateBR(initial?.date ?? todayISO()));
    setType(initial?.type ?? 'expense');
    setCategory(initial?.category ?? 'alimentacao');
    setError(null);
    setBusy(false);
  }, [visible, initial]);

  const availableCategories = CATEGORY_IDS.filter((c) => isIncomeCategory(c) === (type === 'income'));

  const changeType = (next: TransactionType): void => {
    setType(next);
    if (isIncomeCategory(category) !== (next === 'income')) {
      setCategory(next === 'income' ? 'salario' : 'alimentacao');
    }
  };

  const submit = async (): Promise<void> => {
    const candidate = {
      title,
      category,
      type,
      amount: parseAmountBR(amountText),
      date: parseDateBR(dateText),
    };
    const parsed = TransactionInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      setError(FIELD_MESSAGES[field] ?? 'Confira os dados informados.');
      return;
    }
    setBusy(true);
    const message = await onSubmit(parsed.data);
    setBusy(false);
    if (message) setError(message);
    else onClose();
  };

  const remove = async (): Promise<void> => {
    if (!onDelete) return;
    setBusy(true);
    const message = await onDelete();
    setBusy(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading} accessibilityRole="header">
              {heading}
            </Text>

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.row}>
              {(['expense', 'income'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => changeType(t)}
                  style={[styles.chip, type === t && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === t }}
                >
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                    {t === 'expense' ? 'Despesa' : 'Receita'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholder="Ex.: Supermercado"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Título"
            />

            <Text style={styles.label}>Valor (R$)</Text>
            <TextInput
              style={styles.input}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Valor em reais"
            />

            <Text style={styles.label}>Data</Text>
            <TextInput
              style={styles.input}
              value={dateText}
              onChangeText={setDateText}
              keyboardType="numbers-and-punctuation"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
              accessibilityLabel="Data no formato dia, mês e ano"
            />

            <Text style={styles.label}>Categoria</Text>
            <View style={styles.wrap}>
              {availableCategories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, category === c && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === c }}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{categories[c].label}</Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void submit()}
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{busy ? 'Salvando…' : submitLabel}</Text>
            </Pressable>

            {onDelete ? (
              <Pressable onPress={() => void remove()} disabled={busy} style={styles.danger} accessibilityRole="button">
                <Text style={styles.dangerText}>Excluir lançamento</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={onClose} disabled={busy} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  chipTextActive: { color: colors.onPrimary },
  error: { color: colors.expense, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  primary: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  danger: {
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: colors.expense, fontSize: 16, fontWeight: '800' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
});
