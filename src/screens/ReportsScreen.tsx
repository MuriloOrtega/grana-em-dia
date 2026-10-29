import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import LoadGate from '../components/LoadGate';
import ProgressBar from '../components/ProgressBar';
import ScreenContainer from '../components/ScreenContainer';
import { categories } from '../data/mock';
import { useTransactions } from '../data/TransactionsProvider';
import { colors, spacing } from '../theme';
import { currentMonthKey, isInMonth, monthLabel } from '../utils/dates';
import { formatBRL, formatPercent } from '../utils/format';
import { getExpensesByCategory, getTotals } from '../utils/finance';

export default function ReportsScreen(): React.JSX.Element {
  const { items, status, errorMessage, refresh } = useTransactions();
  const monthKey = currentMonthKey();
  const monthItems = items.filter((t) => isInMonth(t.date, monthKey));
  const totals = getTotals(monthItems);
  const byCategory = getExpensesByCategory(monthItems);

  return (
    <ScreenContainer title="Relatórios" subtitle={`Gastos por categoria · ${monthLabel(monthKey)}`}>
      <LoadGate status={status} errorMessage={errorMessage} onRetry={() => void refresh()}>
        <Card style={styles.total}>
          <Text style={styles.totalLabel}>Total de despesas</Text>
          <Text style={styles.totalValue}>{formatBRL(totals.expense)}</Text>
        </Card>

        <Card style={styles.list}>
          {byCategory.length === 0 ? (
            <Text style={styles.empty}>Sem despesas neste mês.</Text>
          ) : (
            byCategory.map((item) => {
              const info = categories[item.category];
              return (
                <View key={item.category} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Ionicons name={info.icon} size={20} color={info.color} />
                    <Text style={styles.itemName}>{info.label}</Text>
                    <Text style={styles.itemValue}>{formatBRL(item.total)}</Text>
                  </View>
                  <ProgressBar
                    progress={item.percent / 100}
                    color={info.color}
                    label={`${info.label}: ${formatPercent(item.percent)} dos gastos`}
                  />
                  <Text style={styles.itemPercent}>{formatPercent(item.percent)} dos gastos</Text>
                </View>
              );
            })
          )}
        </Card>
      </LoadGate>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  total: { gap: spacing.xs },
  totalLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800', color: colors.expense },
  list: { gap: spacing.lg },
  item: { gap: spacing.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  itemValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  itemPercent: { fontSize: 12, color: colors.textMuted },
  empty: { color: colors.textMuted, fontSize: 14 },
});
