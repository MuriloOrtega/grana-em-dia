import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import Card from '../components/Card';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme';
import type { IconName } from '../types';

const infoRows: { icon: IconName; title: string; description: string }[] = [
  { icon: 'lock-closed-outline', title: 'Dados protegidos', description: 'Seus lançamentos ficam vinculados à sua conta e só você pode acessá-los.' },
  { icon: 'sparkles-outline', title: 'Assistente com confirmação', description: 'O assistente apenas sugere lançamentos. Nada é salvo sem a sua confirmação.' },
  { icon: 'flask-outline', title: 'Metas e orçamento de exemplo', description: 'Metas e orçamento mensal ainda são demonstrativos.' },
];

export default function ProfileScreen(): React.JSX.Element {
  const { email, signOut } = useAuth();

  const confirmSignOut = (): void => {
    Alert.alert('Sair da conta', 'Você precisará entrar novamente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScreenContainer title="Perfil">
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.onPrimary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {email ?? 'Conta'}
          </Text>
          <Text style={styles.userMeta}>Sessão ativa</Text>
        </View>
      </Card>

      <Card style={styles.list}>
        {infoRows.map((row) => (
          <View key={row.title} style={styles.row} accessible accessibilityLabel={`${row.title}. ${row.description}`}>
            <Ionicons name={row.icon} size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowDescription}>{row.description}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button" accessibilityLabel="Sair da conta">
        <Text style={styles.signOutText}>Sair da conta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 18, fontWeight: '800', color: colors.text },
  userMeta: { fontSize: 14, color: colors.textMuted },
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowDescription: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  signOut: {
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: colors.expense, fontSize: 16, fontWeight: '800' },
});
