import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { answerLocally } from '../assistant/localAssistant';
import DemoBanner from '../components/DemoBanner';
import ProposalCard from '../components/ProposalCard';
import TransactionFormModal from '../components/TransactionFormModal';
import { suggestedMessages } from '../data/mock';
import { useTransactions } from '../data/TransactionsProvider';
import { findPossibleDuplicate } from '../services/duplicates';
import { colors, radius, spacing } from '../theme';
import type { ChatMessage, ProposalState } from '../types';
import { newRequestId } from '../utils/id';

const initialMessages: ChatMessage[] = [
  {
    id: 'm0',
    role: 'assistant',
    text: 'Olá! Descreva um gasto ou uma receita (ex.: "gastei 45,90 no mercado hoje") e eu sugiro o lançamento. Também respondo perguntas como "quanto gastei este mês?". Digite "ajuda" para ver o que sei fazer. Nada é salvo sem a sua confirmação.',
  },
];

export default function AssistantScreen(): React.JSX.Element {
  const { items, add } = useTransactions();

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<{ messageId: string; proposal: ProposalState } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const append = (msg: ChatMessage): void => setMessages((prev) => [...prev, msg]);

  const setProposalStatus = (messageId: string, status: ProposalState['status']): void =>
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status } } : m)),
    );

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const stamp = Date.now();
    append({ id: `u${stamp}`, role: 'user', text: trimmed });
    setInput('');
    try {
      // Assistente local: roda no aparelho e só propõe; o usuário confirma antes de salvar.
      const reply = answerLocally(trimmed, { transactions: items });
      if (reply.kind === 'transaction_proposal') {
        append({
          id: `a${stamp}`,
          role: 'assistant',
          text: 'Entendi assim:',
          proposal: {
            requestId: newRequestId(),
            transaction: reply.transaction,
            ambiguities: reply.ambiguities,
            needsClarification: reply.needs_clarification,
            duplicateOf: findPossibleDuplicate(items, reply.transaction),
            status: 'pending',
          },
        });
      } else if (reply.kind === 'clarification') {
        append({ id: `a${stamp}`, role: 'assistant', text: reply.question });
      } else {
        append({ id: `a${stamp}`, role: 'assistant', text: reply.text });
      }
    } catch {
      append({ id: `a${stamp}`, role: 'assistant', text: 'Não consegui processar essa mensagem. Tente de outro jeito.' });
    }
  };

  const confirm = async (messageId: string, proposal: ProposalState): Promise<void> => {
    setSavingId(messageId);
    setErrors((prev) => ({ ...prev, [messageId]: '' }));
    const result = await add(proposal.transaction, proposal.requestId);
    setSavingId(null);
    if (result.ok) setProposalStatus(messageId, 'saved');
    else setErrors((prev) => ({ ...prev, [messageId]: result.message }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Assistente
          </Text>
          <DemoBanner text="Assistente local: entende frases comuns e nada sai do seu aparelho. Você confirma antes de salvar." />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.chat}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
              <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.text}</Text>
              {m.proposal ? (
                <ProposalCard
                  proposal={m.proposal}
                  busy={savingId === m.id}
                  error={errors[m.id] || null}
                  onConfirm={() => void confirm(m.id, m.proposal as ProposalState)}
                  onReview={() => setReviewing({ messageId: m.id, proposal: m.proposal as ProposalState })}
                  onDiscard={() => setProposalStatus(m.id, 'discarded')}
                />
              ) : null}
            </View>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {suggestedMessages.map((q) => (
            <Pressable
              key={q}
              onPress={() => void send(q)}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={`Enviar exemplo: ${q}`}
            >
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ex.: gastei 30 reais de uber ontem"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void send(input)}
            accessibilityLabel="Campo de mensagem"
          />
          <Pressable
            onPress={() => void send(input)}
            style={styles.sendButton}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
          >
            <Ionicons name="send" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <TransactionFormModal
        visible={reviewing !== null}
        heading="Revisar lançamento"
        submitLabel="Salvar"
        initial={reviewing?.proposal.transaction}
        onClose={() => setReviewing(null)}
        onSubmit={async (tx) => {
          if (!reviewing) return 'Sugestão não encontrada.';
          const result = await add(tx, reviewing.proposal.requestId);
          if (!result.ok) return result.message;
          setProposalStatus(reviewing.messageId, 'saved');
          return null;
        }}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  chat: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  bubble: { maxWidth: '90%', borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  botBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  botText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  userText: { color: colors.onPrimary, fontSize: 15, lineHeight: 21 },
  chipsScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chipText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
