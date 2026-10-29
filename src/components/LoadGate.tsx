import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Card from './Card';
import { colors, radius, spacing } from '../theme';

interface LoadGateProps {
  status: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  onRetry(): void;
  children: React.ReactNode;
}

/** Mostra carregando/erro (com nova tentativa) e só renderiza o conteúdo quando os dados estão prontos. */
export default function LoadGate({ status, errorMessage, onRetry, children }: LoadGateProps): React.JSX.Element {
  if (status === 'loading') {
    return (
      <Card style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando lançamentos" />
      </Card>
    );
  }
  if (status === 'error') {
    return (
      <Card style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage ?? 'Algo deu errado. Tente novamente.'}
        </Text>
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </Card>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md },
  error: { color: colors.expense, fontWeight: '600', textAlign: 'center' },
  retry: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  retryText: { color: colors.onPrimary, fontWeight: '800' },
});
