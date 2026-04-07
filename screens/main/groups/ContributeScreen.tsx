import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
  Contribute: {
    group_id: number;
    group_title: string;
    payable_amount: number;
    payout_position?: number;
    payment_out_day?: number;
  };
  Signin: undefined;
};

interface Transaction {
  id: number;
  type: string;
  description: string;
  amount: number;
  status: 'verified' | 'pending' | 'under_review' | 'rejected';
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const getPaymentDueDate = (paymentDay?: number): string => {
  if (!paymentDay) return '—';
  const today = new Date();
  const d = today.getDate();
  const m = today.getMonth();
  const y = today.getFullYear();
  const target = d < paymentDay
    ? new Date(y, m, paymentDay)
    : new Date(y, m + 1, paymentDay);
  return target.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  verified:    { label: 'Verified',      color: D.primary,   bg: 'rgba(0,214,143,0.12)',   icon: 'checkmark-circle' },
  pending:     { label: 'Pending',       color: D.accent,    bg: D.accentSoft,             icon: 'time-outline' },
  under_review:{ label: 'Under review',  color: D.warn,      bg: D.warnSoft,               icon: 'alert-circle-outline' },
  rejected:    { label: 'Rejected',      color: D.danger,    bg: D.dangerSoft,             icon: 'close-circle' },
};

// ─── Transaction Row ─────────────────────────────────────────────────────────

const TxRow: React.FC<{ tx: Transaction; groupTitle: string; slotLabel: string }> = ({ tx, groupTitle, slotLabel }) => {
  const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
  const isDebit = tx.amount < 0;

  return (
    <View style={txStyles.row}>
      <View style={[txStyles.iconWrap, { backgroundColor: isDebit ? 'rgba(239,68,68,0.12)' : 'rgba(0,214,143,0.12)' }]}>
        <Ionicons
          name={isDebit ? 'arrow-up' : 'arrow-down'}
          size={18}
          color={isDebit ? D.danger : D.primary}
        />
      </View>
      <View style={txStyles.meta}>
        <Text style={txStyles.title} numberOfLines={1}>{tx.description || 'Monthly contribution'}</Text>
        <Text style={txStyles.sub}>{groupTitle} · {slotLabel}</Text>
        <View style={[txStyles.statusPill, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={11} color={s.color} />
          <Text style={[txStyles.statusLabel, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>
      <View style={txStyles.right}>
        <Text style={[txStyles.amount, { color: isDebit ? D.danger : D.primary }]}>
          {isDebit ? '' : '+'}{formatCurrency(Math.abs(tx.amount))}
        </Text>
        <Text style={txStyles.date}>{formatDate(tx.created_at)}</Text>
      </View>
    </View>
  );
};

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  meta: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', color: D.text },
  sub: { fontSize: 12, color: D.textMuted },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 11, color: D.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContributeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Contribute'>>();
  const {
    group_id,
    group_title,
    payable_amount,
    payout_position,
    payment_out_day,
  } = route.params;

  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const slotLabel = payout_position ? `Slot ${payout_position}` : 'Member';
  const dueDate = getPaymentDueDate(payment_out_day);

  // ── Load transaction history ──
  const loadTransactions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(
        `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/transactions`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      );
      setTransactions(res.data?.data ?? []);
    } catch {
      // silent — history is supplementary
    } finally {
      setTxLoading(false);
    }
  }, [group_id]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ── Pick proof file ──
  const pickProof = () => {
    Alert.alert(
      'Attach Proof',
      'Please have your payment screenshot or bank receipt ready to submit.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => setProofFile({ name: 'payment_proof.jpg', uri: 'local://proof' }),
        },
      ],
    );
  };

  // ── Submit contribution ──
  const handleSubmit = async () => {
    if (!proofFile) {
      Alert.alert('Proof required', 'Please attach a screenshot or bank receipt before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { navigation.navigate('Signin'); return; }

      const form = new FormData();
      form.append('group_id', String(group_id));
      form.append('amount', String(payable_amount));
      if (note.trim()) form.append('note', note.trim());
      form.append('proof_attached', 'true');

      await axios.post(
        `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/contribute`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
            Accept: 'application/json',
          },
        },
      );

      Alert.alert(
        '🎉 Submitted!',
        'Your contribution has been submitted and is under review. You\'ll be notified once it\'s verified.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Submission failed. Please try again.';
      if (err?.response?.status === 401) { navigation.navigate('Signin'); return; }
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={D.textSub} />
        </TouchableOpacity>
        <View style={styles.navMid}>
          <Text style={styles.navTitle}>Contribute</Text>
          <Text style={styles.navSub} numberOfLines={1}>{group_title}</Text>
        </View>
        <View style={[styles.backBtn, { backgroundColor: 'rgba(0,214,143,0.12)', borderColor: 'rgba(0,214,143,0.25)' }]}>
          <Ionicons name="wallet-outline" size={17} color={D.primary} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero amount card ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#1e2a22', '#1a1a1a']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {/* Decorative glow blob */}
          <View style={styles.heroGlowBlob} />

          <Ionicons name="cash-outline" size={130} color="#00d68f" style={styles.heroGhostIcon} />

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="people-outline" size={12} color={D.primary} />
              <Text style={styles.heroBadgeText}>{slotLabel}</Text>
            </View>
            {payment_out_day ? (
              <View style={[styles.heroBadge, { borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.10)' }]}>
                <Ionicons name="calendar-outline" size={12} color={D.warn} />
                <Text style={[styles.heroBadgeText, { color: D.warn }]}>Due {dueDate}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroLabel}>Your contribution</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroCurrency}>£</Text>
            <Text style={styles.heroAmount}>
              {payable_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroLockBadge}>
              <Ionicons name="lock-closed-outline" size={11} color={D.textMuted} />
              <Text style={styles.heroLockText}>Fixed group amount</Text>
            </View>
            <View style={[styles.heroLockBadge, { borderColor: 'rgba(0,214,143,0.25)', backgroundColor: 'rgba(0,214,143,0.08)' }]}>
              <Ionicons name="shield-checkmark-outline" size={11} color={D.primary} />
              <Text style={[styles.heroLockText, { color: D.primary }]}>Secure submission</Text>
            </View>
          </View>
        </View>

        {/* ── Step 1: Proof of payment ── */}
        <View style={styles.stepSection}>
          <View style={styles.stepHeader}>
            <LinearGradient colors={['#00d68f', '#00bb7a']} style={styles.stepBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.stepBadgeNum}>1</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Attach payment proof</Text>
              <Text style={styles.stepSub}>Screenshot or bank receipt</Text>
            </View>
            <View style={styles.requiredChip}>
              <Text style={styles.requiredChipText}>Required</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.uploadArea, proofFile && styles.uploadAreaDone]}
            onPress={pickProof}
            activeOpacity={0.8}
          >
            {proofFile ? (
              <LinearGradient
                colors={['rgba(0,214,143,0.08)', 'rgba(0,187,122,0.04)']}
                style={styles.uploadDoneInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.uploadDoneIcon}>
                  <Ionicons name="checkmark-circle" size={32} color={D.primary} />
                </View>
                <Text style={styles.uploadDoneName} numberOfLines={1}>{proofFile.name}</Text>
                <Text style={styles.uploadDoneHint}>Tap to change</Text>
              </LinearGradient>
            ) : (
              <View style={styles.uploadEmptyInner}>
                <View style={styles.uploadIconRing}>
                  <Ionicons name="cloud-upload-outline" size={28} color={D.textSub} />
                </View>
                <Text style={styles.uploadTitle}>Tap to attach proof</Text>
                <Text style={styles.uploadSub}>Bank transfer receipt or payment screenshot</Text>
                <View style={styles.uploadFormatRow}>
                  {[
                    { label: 'PDF', icon: 'document-text-outline' as const },
                    { label: 'JPG', icon: 'image-outline' as const },
                    { label: 'PNG', icon: 'image-outline' as const },
                  ].map(f => (
                    <View key={f.label} style={styles.formatChip}>
                      <Ionicons name={f.icon} size={12} color={D.textSub} />
                      <Text style={styles.formatChipText}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Step 2: Note ── */}
        <View style={styles.stepSection}>
          <View style={styles.stepHeader}>
            <LinearGradient colors={['#6eb5ff', '#4a9eff']} style={styles.stepBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.stepBadgeNum}>2</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Add a note</Text>
              <Text style={styles.stepSub}>Help us identify your payment faster</Text>
            </View>
            <View style={[styles.requiredChip, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: D.border }]}>
              <Text style={[styles.requiredChipText, { color: D.textMuted }]}>Optional</Text>
            </View>
          </View>

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Bank transfer ref #20948, sent via Monzo..."
            placeholderTextColor={D.textMuted}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          {note.length > 200 && (
            <Text style={styles.noteCounter}>{note.length}/300</Text>
          )}
        </View>

        {/* ── Transaction history ── */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Ionicons name="time-outline" size={16} color={D.textSub} />
            <Text style={styles.historyHeading}>Transaction history</Text>
            {transactions.length > 0 && (
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountText}>{transactions.length}</Text>
              </View>
            )}
          </View>

          {txLoading ? (
            <View style={styles.txLoadingWrap}>
              <ActivityIndicator size="small" color={D.primary} />
              <Text style={styles.txLoadingText}>Loading history…</Text>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <View style={styles.emptyHistoryIcon}>
                <Ionicons name="receipt-outline" size={28} color={D.textMuted} />
              </View>
              <Text style={styles.emptyHistoryTitle}>No transactions yet</Text>
              <Text style={styles.emptyHistoryText}>Your contributions to this group will appear here</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map(tx => (
                <TxRow key={tx.id} tx={tx} groupTitle={group_title} slotLabel={slotLabel} />
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Sticky submit bar ── */}
      <View style={styles.submitBar}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !proofFile) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !proofFile}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={proofFile ? ['#00d68f', '#00bb7a'] : ['#2a2a2a', '#2a2a2a']}
            style={styles.submitGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#0a1a0f" />
            ) : (
              <>
                <Text style={[styles.submitLabel, !proofFile && styles.submitLabelDisabled]}>
                  Submit Contribution
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={proofFile ? '#0a1a0f' : D.textMuted}
                />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.submitHint}>Reviewed within 24–48 hours</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },

  // ── Navbar ──
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: D.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
    flexShrink: 0,
  },
  navMid: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: D.text,
  },
  navSub: {
    fontSize: 11,
    color: D.textMuted,
    marginTop: 1,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
    paddingTop: 4,
  },

  // ── Hero card ──
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.15)',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 4,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  heroGlowBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,214,143,0.07)',
  },
  heroGhostIcon: {
    position: 'absolute',
    right: -22,
    top: -10,
    opacity: 0.06,
    transform: [{ rotate: '-15deg' }],
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.30)',
    backgroundColor: 'rgba(0,214,143,0.08)',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: D.primary,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: D.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    marginTop: 2,
  },
  heroCurrency: {
    fontSize: 22,
    fontWeight: '700',
    color: D.textSub,
    marginTop: 8,
  },
  heroAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: D.text,
    letterSpacing: -1.5,
    lineHeight: 58,
  },
  heroFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  heroLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: D.border,
    backgroundColor: D.surface,
  },
  heroLockText: {
    fontSize: 11,
    color: D.textMuted,
    fontWeight: '500',
  },

  // ── Step sections ──
  stepSection: {
    gap: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0a1a0f',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: D.text,
  },
  stepSub: {
    fontSize: 12,
    color: D.textMuted,
    marginTop: 1,
  },
  requiredChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  requiredChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: D.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Upload area ──
  uploadArea: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: D.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 150,
  },
  uploadAreaDone: {
    borderStyle: 'solid',
    borderColor: 'rgba(0,214,143,0.35)',
  },
  uploadEmptyInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 8,
    minHeight: 150,
  },
  uploadDoneInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 6,
    minHeight: 150,
  },
  uploadIconRing: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadDoneIcon: {
    marginBottom: 4,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: D.text,
  },
  uploadSub: {
    fontSize: 13,
    color: D.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  uploadDoneName: {
    fontSize: 14,
    fontWeight: '600',
    color: D.primary,
    maxWidth: '80%',
    textAlign: 'center',
  },
  uploadDoneHint: {
    fontSize: 12,
    color: D.textMuted,
  },
  uploadFormatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: D.textSub,
  },

  // ── Note ──
  noteInput: {
    backgroundColor: D.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 14,
    color: D.text,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  noteCounter: {
    fontSize: 11,
    color: D.textMuted,
    alignSelf: 'flex-end',
    marginTop: -4,
  },

  // ── History ──
  historySection: {
    gap: 12,
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: D.text,
    flex: 1,
  },
  historyCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: D.accentSoft,
  },
  historyCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: D.accent,
  },
  txLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  txLoadingText: {
    fontSize: 13,
    color: D.textMuted,
  },
  txList: {
    backgroundColor: D.surfaceCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyHistoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: D.textSub,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: D.textMuted,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 18,
  },

  // ── Sticky submit bar ──
  submitBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: D.border,
    backgroundColor: D.bg,
  },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitGrad: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1a0f',
    letterSpacing: 0.2,
  },
  submitLabelDisabled: {
    color: D.textMuted,
  },
  submitHint: {
    fontSize: 12,
    color: D.textMuted,
    textAlign: 'center',
  },
});
