import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categories } from '../data/mock';
import { colors, radius, spacing } from '../theme';
import type { Transaction } from '../types';
import { formatBRL, formatDateBR } from '../utils/format';

interface TransactionItemProps {
  transaction: Transaction;
  /** Quando informado, o item vira um botão (usado para editar o lançamento). */
  onPress?: () => void;
}

export default function TransactionItem({ transaction, onPress }: TransactionItemProps): React.JSX.Element {
  const info = categories[transaction.category];
  const isIncome = transaction.type === 'income';
  const signedValue = `${isIncome ? '+' : '-'} ${formatBRL(transaction.amount)}`;
  const label = `${transaction.title}, ${info.label}, ${formatDateBR(transaction.date)}, ${
    isIncome ? 'receita' : 'despesa'
  } de ${formatBRL(transaction.amount)}`;

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: `${info.color}1A` }]}>
        <Ionicons name={info.icon} size={22} color={info.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {transaction.title}
        </Text>
        <Text style={styles.meta}>
          {info.label} · {formatDateBR(transaction.date)}
        </Text>
      </View>
      <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>{signedValue}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={styles.row}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Toque para editar.`}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 15, fontWeight: '800' },
});
