import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import RootTabs from './src/navigation/RootTabs';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { TransactionsProvider } from './src/data/TransactionsProvider';
import AuthScreen from './src/screens/AuthScreen';
import { colors, spacing } from './src/theme';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
  },
};

function Gate(): React.JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando" />
      </View>
    );
  }
  if (status === 'misconfigured') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>App não configurado</Text>
        <Text style={styles.text}>
          Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (somente a chave publicável) e reinicie o app.
        </Text>
      </View>
    );
  }
  if (status === 'signedOut') return <AuthScreen />;

  return (
    <TransactionsProvider>
      <NavigationContainer theme={navigationTheme}>
        <RootTabs />
      </NavigationContainer>
    </TransactionsProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  text: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
