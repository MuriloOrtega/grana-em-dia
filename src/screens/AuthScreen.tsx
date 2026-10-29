import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const PRIMARY_LABEL: Record<Mode, string> = {
  login: 'Entrar',
  signup: 'Cadastrar',
  forgot: 'Enviar código',
  reset: 'Definir nova senha',
};

const SUBTITLES: Record<Mode, string> = {
  login: 'Entre na sua conta',
  signup: 'Crie sua conta',
  forgot: 'Recuperar senha: informe seu e-mail',
  reset: 'Digite o código do e-mail e a nova senha',
};

export default function AuthScreen(): React.JSX.Element {
  const { signIn, signUp, requestPasswordReset, resetPassword, notice, clearNotice } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    clearNotice();
    let result: { ok: boolean; message?: string };
    if (mode === 'login') result = await signIn(email, password);
    else if (mode === 'signup') result = await signUp(email, password);
    else if (mode === 'forgot') result = await requestPasswordReset(email);
    else result = await resetPassword(email, code, password);
    setBusy(false);
    if (!result.ok) setMessage({ text: result.message ?? '', error: true });
    else if (result.message) setMessage({ text: result.message, error: false });
    if (result.ok && mode === 'forgot') setMode('reset');
    if (result.ok && mode === 'reset') {
      setCode('');
      setPassword('');
    }
    // Em caso de sucesso no login, o AuthProvider troca a tela automaticamente.
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.brand} accessibilityRole="header">
            Grana em Dia
          </Text>
          <Text style={styles.subtitle}>{SUBTITLES[mode]}</Text>

          {notice ? (
            <Text style={styles.notice} accessibilityRole="alert">
              {notice}
            </Text>
          ) : null}

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            accessibilityLabel="E-mail"
          />
          {mode === 'reset' ? (
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Código recebido por e-mail"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={12}
              textContentType="oneTimeCode"
              accessibilityLabel="Código recebido por e-mail"
            />
          ) : null}
          {mode !== 'forgot' ? (
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'reset' ? 'Nova senha (mínimo 8 caracteres)' : 'Senha (mínimo 8 caracteres)'}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            accessibilityLabel="Senha"
            onSubmitEditing={() => void submit()}
          />
          ) : null}

          {message ? (
            <Text style={[styles.message, message.error ? styles.error : styles.success]} accessibilityRole="alert">
              {message.text}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void submit()}
            disabled={busy}
            style={[styles.primary, busy && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{busy ? 'Aguarde…' : PRIMARY_LABEL[mode]}</Text>
          </Pressable>

          {mode === 'login' ? (
            <Pressable
              onPress={() => {
                setMode('forgot');
                setMessage(null);
              }}
              style={styles.link}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Esqueci minha senha</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setMessage(null);
              setCode('');
            }}
            style={styles.link}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>
              {mode === 'login' ? 'Não tem conta? Cadastre-se' : mode === 'signup' ? 'Já tem conta? Entre' : 'Voltar para o login'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  brand: { fontSize: 32, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.md },
  notice: {
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    padding: spacing.md,
    borderRadius: radius.md,
    fontWeight: '600',
  },
  input: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
  message: { fontSize: 14, fontWeight: '600' },
  error: { color: colors.expense },
  success: { color: colors.primaryDark },
  primary: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  link: { alignItems: 'center', paddingVertical: spacing.md },
  linkText: { color: colors.primaryDark, fontWeight: '700', fontSize: 15 },
});
