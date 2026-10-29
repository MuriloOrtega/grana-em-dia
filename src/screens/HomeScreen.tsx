import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../components/Card';
import LoadGate from '../components/LoadGate';
import ProgressBar from '../components/ProgressBar';
import ScreenContainer from '../components/ScreenContainer';
import SummaryTile from '../components/SummaryTile';
import TransactionItem from '../components/TransactionItem';
import { MONTHLY_BUDGET } from '../data/mock';
import { useTransactions } from '../data/TransactionsProvider';
import { colors, radius, spacing } from '../theme';
import { currentMonthKey, isInMonth, monthLabel } from '../utils/dates';
import { formatBRL, formatPercent } from '../utils/format';
import { getTotals } from '../utils/finance';

export default function HomeScreen(): React.JSX.Element {
  const { items, status, errorMessage, refresh } = useTransactions();
  const monthKey = currentMonthKey();
  const monthItems = items.filter((t) => isInMonth(t.date, monthKey));
  const totals = getTotals(monthItems);
  const used = totals.expense / MONTHLY_BUDGET;
  const remaining = MONTHLY_BUDGET - totals.expense;
  const recent = items.slice(0, 5);

  return (
    <ScreenContainer title="Grana em Dia" subtitle={`Resumo de ${monthLabel(monthKey)}`}>
      <LoadGate status={status} errorMessage={errorMessage} onRetry={() => void refresh()}>
        <View style={styles.balanceCard} accessible accessibilityLabel={`Saldo do mês: ${formatBRL(totals.balance)}`}>
          <Text style={styles.balanceLabel}>Saldo do mês</Text>
          <Text style={styles.balanceValue}>{formatBRL(totals.balance)}</Text>
        </View>

        <View style={styles.tiles}>
          <SummaryTile label="Receitas" value={formatBRL(totals.income)} icon="arrow-down-circle-outline" tint={colors.income} />
          <SummaryTile label="Despesas" value={formatBRL(totals.expense)} icon="arrow-up-circle-outline" tint={colors.expense} />
        </View>

        <Card style={styles.gap}>
          <Text style={styles.sectionTitle}>Orçamento mensal (exemplo)</Text>
          <ProgressBar
            progress={used}
            color={used > 0.9 ? colors.expense : colors.primary}
            label={`${formatPercent(used * 100)} do orçamento utilizado`}
          />
          <Text style={styles.budgetText}>
            {formatBRL(totals.expense)} de {formatBRL(MONTHLY_BUDGET)} ({formatPercent(used * 100)})
          </Text>
          <Text style={styles.budgetHint}>
            {remaining >= 0
              ? `Ainda restam ${formatBRL(remaining)} neste mês.`
              : `Limite ultrapassado em ${formatBRL(Math.abs(remaining))}.`}
          </Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Últimos lançamentos</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>Nenhum lançamento ainda. Use o Assistente ou a aba Lançamentos para começar.</Text>
          ) : (
            recent.map((t) => <TransactionItem key={t.id} transaction={t} />)
          )}
        </Card>
      </LoadGate>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  balanceLabel: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  balanceValue: { color: colors.onPrimary, fontSize: 34, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: spacing.md },
  gap: { gap: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  budgetText: { fontSize: 15, fontWeight: '700', color: colors.text },
  budgetHint: { fontSize: 13, color: colors.textMuted },
  empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
