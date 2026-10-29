import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../components/Card';
import LoadGate from '../components/LoadGate';
import ScreenContainer from '../components/ScreenContainer';
import TransactionFormModal from '../components/TransactionFormModal';
import TransactionItem from '../components/TransactionItem';
import { useTransactions } from '../data/TransactionsProvider';
import { findPossibleDuplicate } from '../services/duplicates';
import { colors, radius, spacing } from '../theme';
import type { Transaction } from '../types';
import { currentMonthKey, monthLabel } from '../utils/dates';
import { newRequestId } from '../utils/id';
import { formatBRL } from '../utils/format';

type Filter = 'all' | 'income' | 'expense';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'income', label: 'Receitas' },
  { id: 'expense', label: 'Despesas' },
];

export default function TransactionsScreen(): React.JSX.Element {
  const { items, status, errorMessage, refresh, add, update, remove } = useTransactions();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  // Mesmo id durante a abertura do formulário: reenvio não duplica.
  const [requestId, setRequestId] = useState<string>(newRequestId);

  const visible = items.filter((t) => filter === 'all' || t.type === filter);

  const openCreate = (): void => {
    setRequestId(newRequestId());
    setCreating(true);
  };

  return (
    <ScreenContainer title="Lançamentos" subtitle={monthLabel(currentMonthKey())}>
      <Pressable onPress={openCreate} style={styles.add} accessibilityRole="button" accessibilityLabel="Novo lançamento">
        <Text style={styles.addText}>+ Novo lançamento</Text>
      </Pressable>

      <View style={styles.filters} accessibilityRole="tablist">
        {filters.map((f) => {
          const active = f.id === filter;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filter, active && styles.filterActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <LoadGate status={status} errorMessage={errorMessage} onRetry={() => void refresh()}>
        <Card>
          {visible.length === 0 ? (
            <Text style={styles.empty}>Nenhum lançamento por aqui.</Text>
          ) : (
            visible.map((t) => <TransactionItem key={t.id} transaction={t} onPress={() => setEditing(t)} />)
          )}
        </Card>
      </LoadGate>

      <TransactionFormModal
        visible={creating}
        heading="Novo lançamento"
        submitLabel="Salvar"
        onClose={() => setCreating(false)}
        onSubmit={async (input) => {
          const duplicate = findPossibleDuplicate(items, input);
          if (duplicate) {
            const proceed = await new Promise<boolean>((resolve) =>
              Alert.alert(
                'Possível duplicata',
                `Já existe um lançamento igual (${duplicate.title}, ${formatBRL(duplicate.amount)}) nesta data. Salvar mesmo assim?`,
                [
                  { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Salvar mesmo assim', onPress: () => resolve(true) },
                ],
              ),
            );
            if (!proceed) return 'Lançamento não salvo.';
          }
          const result = await add(input, requestId);
          return result.ok ? null : result.message;
        }}
      />

      <TransactionFormModal
        visible={editing !== null}
        heading="Editar lançamento"
        submitLabel="Salvar alterações"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (!editing) return 'Registro não encontrado.';
          const result = await update(editing.id, input);
          return result.ok ? null : result.message;
        }}
        onDelete={async () => {
          if (!editing) return 'Registro não encontrado.';
          const confirmed = await new Promise<boolean>((resolve) =>
            Alert.alert('Excluir lançamento', 'Esta ação não pode ser desfeita.', [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Excluir', style: 'destructive', onPress: () => resolve(true) },
            ]),
          );
          if (!confirmed) return 'Exclusão cancelada.';
          const result = await remove(editing.id);
          return result.ok ? null : result.message;
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  add: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.onPrimary, fontWeight: '800', fontSize: 16 },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  filterTextActive: { color: colors.onPrimary },
  empty: { color: colors.textMuted, fontSize: 14 },
});
