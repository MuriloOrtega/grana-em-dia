// Cartão de confirmação: o assistente só PROPÕE. O lançamento é gravado apenas após o toque do usuário.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categories } from '../data/mock';
import { colors, radius, spacing } from '../theme';
import type { ProposalState } from '../types';
import { formatBRL, formatDateBR } from '../utils/format';

interface ProposalCardProps {
  proposal: ProposalState;
  busy: boolean;
  error: string | null;
  onConfirm(): void;
  onReview(): void;
  onDiscard(): void;
}

export default function ProposalCard({
  proposal,
  busy,
  error,
  onConfirm,
  onReview,
  onDiscard,
}: ProposalCardProps): React.JSX.Element {
  const t = proposal.transaction;

  if (proposal.status === 'saved') {
    return <Text style={styles.saved}>Lançamento salvo.</Text>;
  }
  if (proposal.status === 'discarded') {
    return <Text style={styles.discarded}>Sugestão descartada.</Text>;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Confirme o lançamento</Text>
      <Text style={styles.line}>{t.title}</Text>
      <Text style={styles.meta}>
        {t.type === 'income' ? 'Receita' : 'Despesa'} · {categories[t.category].label} · {formatDateBR(t.date)}
      </Text>
      <Text style={[styles.amount, { color: t.type === 'income' ? colors.income : colors.expense }]}>
        {formatBRL(t.amount)}
      </Text>

      {proposal.ambiguities.length > 0 ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Pontos a conferir</Text>
          {proposal.ambiguities.map((a) => (
            <Text key={a} style={styles.warnText}>
              • {a}
            </Text>
          ))}
        </View>
      ) : null}

      {proposal.duplicateOf ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Possível duplicata</Text>
          <Text style={styles.warnText}>
            Já existe um lançamento igual em {formatDateBR(proposal.duplicateOf.date)}: {proposal.duplicateOf.title}.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {proposal.needsClarification ? (
          <Pressable onPress={onReview} disabled={busy} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button">
            <Text style={styles.primaryText}>Revisar e salvar</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onConfirm} disabled={busy} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button">
              <Text style={styles.primaryText}>
                {busy ? 'Salvando…' : proposal.duplicateOf ? 'Salvar mesmo assim' : 'Confirmar'}
              </Text>
            </Pressable>
            <Pressable onPress={onReview} disabled={busy} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Editar</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={onDiscard} disabled={busy} style={styles.secondary} accessibilityRole="button">
          <Text style={styles.secondaryText}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  heading: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  line: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 22, fontWeight: '800', marginTop: spacing.xs },
  warnBox: { backgroundColor: '#FFF4D6', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, gap: 2 },
  warnTitle: { fontSize: 13, fontWeight: '800', color: colors.warning },
  warnText: { fontSize: 13, color: colors.text },
  error: { color: colors.expense, fontWeight: '600', fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  primary: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 14 },
  secondary: { borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.6 },
  saved: { color: colors.primaryDark, fontWeight: '700' },
  discarded: { color: colors.textMuted, fontWeight: '600' },
});
