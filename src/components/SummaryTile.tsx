import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import type { IconName } from '../types';

interface SummaryTileProps {
  label: string;
  value: string;
  icon: IconName;
  tint: string;
}

export default function SummaryTile({ label, value, icon, tint }: SummaryTileProps): React.JSX.Element {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 18, fontWeight: '800' },
});
