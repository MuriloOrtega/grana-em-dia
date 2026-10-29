import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

interface ProgressBarProps {
  progress: number; // 0 a 1
  color?: string;
  label: string; // descrição para leitores de tela
}

export default function ProgressBar({ progress, color = colors.primary, label }: ProgressBarProps): React.JSX.Element {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, backgroundColor: colors.border, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
