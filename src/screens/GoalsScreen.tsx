import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import ScreenContainer from '../components/ScreenContainer';
import { goals } from '../data/mock';
import { colors, spacing } from '../theme';
import { formatBRL, formatPercent } from '../utils/format';

export default function GoalsScreen(): React.JSX.Element {
  return (
    <ScreenContainer title="Metas" subtitle="Acompanhe seus objetivos" demo>
      {goals.map((goal) => {
        const progress = goal.saved / goal.target;
        return (
          <Card key={goal.id} style={styles.card}>
            <View style={styles.header}>
              <Ionicons name={goal.icon} size={24} color={colors.primary} />
              <Text style={styles.name}>{goal.name}</Text>
              <Text style={styles.percent}>{formatPercent(progress * 100)}</Text>
            </View>
            <ProgressBar progress={progress} label={`${goal.name}: ${formatPercent(progress * 100)} concluído`} />
            <Text style={styles.values}>
              {formatBRL(goal.saved)} de {formatBRL(goal.target)}
            </Text>
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  percent: { fontSize: 16, fontWeight: '800', color: colors.primary },
  values: { fontSize: 14, color: colors.textMuted },
});
