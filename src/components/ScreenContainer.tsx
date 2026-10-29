import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import DemoBanner from './DemoBanner';

interface ScreenContainerProps {
  title: string;
  subtitle?: string;
  /** Exibe o aviso de dados demonstrativos (telas que ainda usam dados fictícios). */
  demo?: boolean;
  children: React.ReactNode;
}

export default function ScreenContainer({ title, subtitle, demo = false, children }: ScreenContainerProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {demo ? <DemoBanner /> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.xs },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
});
