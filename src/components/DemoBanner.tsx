import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

interface DemoBannerProps {
  text?: string;
}

export default function DemoBanner({
  text = 'Dados demonstrativos: todos os valores são fictícios.',
}: DemoBannerProps): React.JSX.Element {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { flex: 1, color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
});
