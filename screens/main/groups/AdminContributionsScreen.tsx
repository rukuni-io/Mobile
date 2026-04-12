import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
  AdminContributions: {
    group_id: number;
    group_title: string;
    member_only?: boolean;
  };
  Signin: undefined;
};

interface ContributionUser {
  id: string;
  name: string;
  email: string;
  mobile?: string | null;
  status: string;
  points?: number;
}

interface ContributionGroup {
  id: string;
  title: string;
  total_users: number;
  target_amount: string;
  payable_amount: string;
  payment_out_day?: number | null;
  contribution_frequency?: string;
  status: string;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
}

interface Contribution {
  id: string;
  group_id: string;
  user_id: string;
  payout_position?: number;
  cycle_number: number;
  amount: string;
  note?: string | null;
  proof_path?: string | null;
  proof_public_id?: string | null;
  due_date: string;
  status: 'pending' | 'under_review' | 'verified' | 'rejected';
  submitted_at: string;
  created_at: string;
  updated_at: string;
  user?: ContributionUser;
  group?: ContributionGroup;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const getInitials = (name?: string) =>
  (name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:      { label: 'Pending',       color: D.accent,   bg: D.accentSoft,             icon: 'time-outline' as const },
  under_review: { label: 'Under review',  color: D.warn,     bg: D.warnSoft,               icon: 'alert-circle-outline' as const },
  verified:     { label: 'Verified',      color: D.primary,  bg: 'rgba(0,214,143,0.12)',   icon: 'checkmark-circle' as const },
  rejected:     { label: 'Rejected',      color: D.danger,   bg: D.dangerSoft,             icon: 'close-circle' as const },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'pending' | 'under_review' | 'verified' | 'rejected';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'pending',      label: 'Pending' },
  { key: 'under_review', label: 'Review' },
  { key: 'verified',     label: 'Verified' },
  { key: 'rejected',     label: 'Rejected' },
];

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);

interface DetailModalProps {
  item: Contribution | null;
  visible: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: 'approve' | 'reject' | null;
  readOnly?: boolean;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, visible, onClose, onApprove, onReject, processing, readOnly = false }) => {
  if (!item) return null;
  const s = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const isActionable = !readOnly && (item.status === 'pending' || item.status === 'under_review');
  const isProcessing = processing !== null;
  const amount = parseFloat(item.amount);
  const proof = item.proof_path ?? null;
  const proofIsImage = proof ? isImageUrl(proof) : false;

  const openInBrowser = async () => {
    if (!proof) return;
    try {
      await Linking.openURL(proof);
    } catch {
      Alert.alert('Error', 'Could not open the file in browser.');
    }
  };

  const DetailRow = ({ icon, label, value, valueColor }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; valueColor?: string }) => (
    <View style={modalStyles.detailRow}>
      <View style={modalStyles.detailIconWrap}>
        <Ionicons name={icon} size={14} color={D.textMuted} />
      </View>
      <Text style={modalStyles.detailLabel}>{label}</Text>
      <Text style={[modalStyles.detailValue, valueColor ? { color: valueColor } : {}]} numberOfLines={2}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={modalStyles.sheet}>
          {/* ── Handle ── */}
          <View style={modalStyles.handle} />

          {/* ── Header ── */}
          <View style={modalStyles.sheetHeader}>
            <View style={modalStyles.avatarWrap}>
              <LinearGradient colors={['rgba(110,181,255,0.25)', 'rgba(110,181,255,0.10)']} style={modalStyles.avatar}>
                <Text style={modalStyles.avatarTxt}>{getInitials(item.user?.name)}</Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.sheetName} numberOfLines={1}>{item.user?.name ?? 'Member'}</Text>
              {item.user?.email ? <Text style={modalStyles.sheetEmail} numberOfLines={1}>{item.user.email}</Text> : null}
              {item.payout_position ? <Text style={modalStyles.sheetSlot}>Slot #{item.payout_position}</Text> : null}
            </View>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={16} color={D.textSub} />
            </TouchableOpacity>
          </View>

          {/* ── Status pill ── */}
          <View style={[modalStyles.statusBanner, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={15} color={s.color} />
            <Text style={[modalStyles.statusBannerText, { color: s.color }]}>{s.label}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modalStyles.scrollContent}>
            {/* ── Details ── */}
            <View style={modalStyles.detailsCard}>
              <DetailRow icon="cash-outline"         label="Amount"    value={formatCurrency(amount)} valueColor={D.primary} />
              <DetailRow icon="repeat-outline"       label="Cycle"     value={`Cycle ${item.cycle_number}`} />
              <DetailRow icon="calendar-outline"     label="Due date"  value={formatDate(item.due_date)} />
              <DetailRow icon="time-outline"         label="Submitted" value={formatDate(item.submitted_at)} />
              {item.note ? <DetailRow icon="chatbubble-outline" label="Note" value={item.note} /> : null}
            </View>

            {/* ── Proof ── */}
            <View style={modalStyles.proofSection}>
              <View style={modalStyles.proofSectionHeader}>
                <Ionicons name="document-attach-outline" size={15} color={D.textSub} />
                <Text style={modalStyles.proofSectionTitle}>Proof of payment</Text>
              </View>

              {!proof ? (
                <View style={modalStyles.noProofWrap}>
                  <Ionicons name="alert-circle-outline" size={24} color={D.textMuted} />
                  <Text style={modalStyles.noProofText}>No proof was attached to this submission</Text>
                </View>
              ) : proofIsImage ? (
                <View style={modalStyles.imageWrap}>
                  <Image
                    source={{ uri: proof }}
                    style={modalStyles.proofImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity style={modalStyles.openInBrowserBtn} onPress={openInBrowser} activeOpacity={0.8}>
                    <Ionicons name="open-outline" size={13} color={D.accent} />
                    <Text style={modalStyles.openInBrowserText}>Open full size</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={modalStyles.pdfBtn} onPress={openInBrowser} activeOpacity={0.8}>
                  <LinearGradient colors={['rgba(110,181,255,0.12)', 'rgba(110,181,255,0.06)']} style={modalStyles.pdfBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={modalStyles.pdfIconWrap}>
                      <Ionicons name="document-text-outline" size={28} color={D.accent} />
                    </View>
                    <Text style={modalStyles.pdfBtnTitle}>Open PDF proof</Text>
                    <Text style={modalStyles.pdfBtnSub}>Tap to view in browser</Text>
                    <View style={modalStyles.pdfOpenChip}>
                      <Ionicons name="open-outline" size={12} color={D.accent} />
                      <Text style={modalStyles.pdfOpenChipText}>Open</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Actions ── */}
            {isActionable && (
              <View style={modalStyles.actions}>
                <TouchableOpacity
                  style={[modalStyles.rejectBtn, isProcessing && modalStyles.btnDisabled]}
                  onPress={() => onReject(item.id)}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  {processing === 'reject'
                    ? <ActivityIndicator size="small" color={D.danger} />
                    : <><Ionicons name="close" size={15} color={D.danger} /><Text style={modalStyles.rejectBtnText}>Reject</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.approveBtn, isProcessing && modalStyles.btnDisabled]}
                  onPress={() => onApprove(item.id)}
                  disabled={isProcessing}
                  activeOpacity={0.85}
                >
                  {processing === 'approve'
                    ? <ActivityIndicator size="small" color="#0a1a0f" />
                    : <><Ionicons name="checkmark" size={15} color="#0a1a0f" /><Text style={modalStyles.approveBtnText}>Approve</Text></>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: D.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: D.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: D.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarWrap: { flexShrink: 0 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 17, fontWeight: '800', color: D.accent },
  sheetName: { fontSize: 15, fontWeight: '700', color: D.text },
  sheetEmail: { fontSize: 12, color: D.textMuted, marginTop: 2 },
  sheetSlot: { fontSize: 11, color: D.primary, fontWeight: '600', marginTop: 3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: D.surfaceCard,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBannerText: { fontSize: 13, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36, gap: 16 },
  detailsCard: {
    backgroundColor: D.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  detailIconWrap: { width: 20, alignItems: 'center' },
  detailLabel: { fontSize: 13, color: D.textMuted, width: 70 },
  detailValue: { flex: 1, fontSize: 13, fontWeight: '600', color: D.text, textAlign: 'right' },
  proofSection: { gap: 10 },
  proofSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  proofSectionTitle: { fontSize: 13, fontWeight: '700', color: D.textSub },
  noProofWrap: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: D.surfaceCard,
    borderRadius: 16,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: D.border,
  },
  noProofText: { fontSize: 13, color: D.textMuted, textAlign: 'center' },
  imageWrap: {
    backgroundColor: D.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
    gap: 0,
  },
  proofImage: {
    width: SCREEN_WIDTH - 40,
    height: (SCREEN_WIDTH - 40) * 0.65,
  },
  openInBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: D.border,
  },
  openInBrowserText: { fontSize: 13, fontWeight: '600', color: D.accent },
  pdfBtn: { borderRadius: 16, overflow: 'hidden' },
  pdfBtnGrad: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(110,181,255,0.25)',
  },
  pdfIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(110,181,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBtnTitle: { fontSize: 14, fontWeight: '700', color: D.text },
  pdfBtnSub: { fontSize: 12, color: D.textMuted },
  pdfOpenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(110,181,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(110,181,255,0.3)',
  },
  pdfOpenChipText: { fontSize: 12, fontWeight: '600', color: D.accent },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: D.dangerSoft,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: D.danger },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: D.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#0a1a0f' },
  btnDisabled: { opacity: 0.55 },
});

// ─── Contribution Card ────────────────────────────────────────────────────────

interface ContributionCardProps {
  item: Contribution;
  onPress: (item: Contribution) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: 'approve' | 'reject' | null;
  readOnly?: boolean;
}

const ContributionCard: React.FC<ContributionCardProps> = ({ item, onPress, onApprove, onReject, processing, readOnly = false }) => {
  const s = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const isActionable = !readOnly && (item.status === 'pending' || item.status === 'under_review');
  const isProcessing = processing !== null;
  const amount = parseFloat(item.amount);
  const hasProof = !!item.proof_path;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={() => onPress(item)} activeOpacity={0.85}>
      {/* ── Header ── */}
      <View style={cardStyles.header}>
        <View style={cardStyles.avatarWrap}>
          <LinearGradient
            colors={['rgba(110,181,255,0.25)', 'rgba(110,181,255,0.10)']}
            style={cardStyles.avatar}
          >
            <Text style={cardStyles.avatarTxt}>{getInitials(item.user?.name)}</Text>
          </LinearGradient>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.userName} numberOfLines={1}>{item.user?.name ?? 'Member'}</Text>
          {item.user?.email ? <Text style={cardStyles.userEmail} numberOfLines={1}>{item.user.email}</Text> : null}
          {item.payout_position ? (
            <Text style={cardStyles.slotLabel}>Slot #{item.payout_position}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={cardStyles.amount}>{formatCurrency(amount)}</Text>
          <Text style={cardStyles.date}>{formatDate(item.submitted_at)}</Text>
        </View>
      </View>

      {/* ── Status + proof row ── */}
      <View style={cardStyles.metaRow}>
        <View style={[cardStyles.statusPill, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={12} color={s.color} />
          <Text style={[cardStyles.statusLabel, { color: s.color }]}>{s.label}</Text>
        </View>
        <View style={cardStyles.cyclePill}>
          <Ionicons name="repeat-outline" size={11} color={D.textMuted} />
          <Text style={cardStyles.cyclePillText}>Cycle {item.cycle_number}</Text>
        </View>
        {hasProof ? (
          <View style={cardStyles.proofAttachedPill}>
            <Ionicons name="document-attach-outline" size={11} color={D.primary} />
            <Text style={cardStyles.proofAttachedText}>Proof attached</Text>
          </View>
        ) : (
          <View style={cardStyles.noProofPill}>
            <Ionicons name="attach-outline" size={11} color={D.textMuted} />
            <Text style={cardStyles.noProofText}>No proof</Text>
          </View>
        )}
        <View style={cardStyles.viewDetailChip}>
          <Text style={cardStyles.viewDetailText}>View</Text>
          <Ionicons name="chevron-forward" size={11} color={D.accent} />
        </View>
      </View>

      {/* ── Note preview ── */}
      {item.note ? (
        <View style={cardStyles.noteWrap}>
          <Ionicons name="chatbubble-outline" size={12} color={D.textMuted} />
          <Text style={cardStyles.noteText} numberOfLines={1}>{item.note}</Text>
        </View>
      ) : null}

      {/* ── Actions (only for pending/under_review) ── */}
      {isActionable && (
        <View style={cardStyles.actions}>
          <TouchableOpacity
            style={[cardStyles.rejectBtn, isProcessing && cardStyles.btnDisabled]}
            onPress={e => { e.stopPropagation?.(); onReject(item.id); }}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {processing === 'reject' ? (
              <ActivityIndicator size="small" color={D.danger} />
            ) : (
              <>
                <Ionicons name="close" size={15} color={D.danger} />
                <Text style={cardStyles.rejectBtnText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[cardStyles.approveBtn, isProcessing && cardStyles.btnDisabled]}
            onPress={e => { e.stopPropagation?.(); onApprove(item.id); }}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {processing === 'approve' ? (
              <ActivityIndicator size="small" color="#0a1a0f" />
            ) : (
              <>
                <Ionicons name="checkmark" size={15} color="#0a1a0f" />
                <Text style={cardStyles.approveBtnText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: D.surfaceCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: D.border,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: { flexShrink: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: D.accent,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: D.text,
  },
  userEmail: {
    fontSize: 12,
    color: D.textMuted,
    marginTop: 1,
  },
  slotLabel: {
    fontSize: 11,
    color: D.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: D.primary,
  },
  date: {
    fontSize: 11,
    color: D.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: D.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(110,181,255,0.25)',
  },
  cyclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: D.surface,
  },
  cyclePillText: { fontSize: 11, color: D.textMuted },
  proofAttachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,214,143,0.10)',
  },
  proofAttachedText: { fontSize: 11, color: D.primary, fontWeight: '600' },
  noProofPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: D.surface,
  },
  noProofText: { fontSize: 11, color: D.textMuted },
  viewDetailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  viewDetailText: { fontSize: 11, fontWeight: '600', color: D.accent },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: D.surface,
    borderRadius: 10,
    padding: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: D.textSub,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: D.dangerSoft,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: D.danger,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: D.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a1a0f',
  },
  btnDisabled: { opacity: 0.55 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminContributionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AdminContributions'>>();
  const { group_id, group_title, member_only = false } = route.params;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Load current user ID once ──
  React.useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) {
        try { setCurrentUserId(JSON.parse(raw).id ?? null); } catch { /* silent */ }
      }
    });
  }, []);

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [processing, setProcessing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Contribution | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // ── Load contributions ──
  const loadContributions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { navigation.navigate('Signin'); return; }

      const res = await axios.get(
        `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/contributions`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      );
      const allContribs: Contribution[] = res.data?.data?.data ?? [];
      setContributions(allContribs);
    } catch (err: any) {
      if (err?.response?.status === 401) { navigation.navigate('Signin'); return; }
      if (!silent) Alert.alert('Error', err?.response?.data?.message ?? 'Failed to load contributions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [group_id]);

  useFocusEffect(useCallback(() => { loadContributions(); }, [loadContributions]));

  // ── Open detail modal ──
  const openDetail = (item: Contribution) => {
    setSelectedItem(item);
    setDetailVisible(true);
  };

  // ── Approve ──
  const handleApprove = (contributionId: string) => {
    const item = contributions.find(c => c.id === contributionId);
    Alert.alert(
      'Approve contribution',
      `Confirm ${item?.user?.name ?? 'member'}'s payment of ${formatCurrency(parseFloat(item?.amount ?? '0'))}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing({ id: contributionId, action: 'approve' });
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) { navigation.navigate('Signin'); return; }

              await axios.put(
                `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/contributions/${contributionId}/verify`,
                {},
                { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
              );

              setContributions(prev =>
                prev.map(c => c.id === contributionId ? { ...c, status: 'verified' } : c),
              );
              setSelectedItem(prev => prev?.id === contributionId ? { ...prev, status: 'verified' as const } : prev);
              setDetailVisible(false);
            } catch (err: any) {
              if (err?.response?.status === 401) { navigation.navigate('Signin'); return; }
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to approve. Please try again.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  // ── Reject ──
  const handleReject = (contributionId: string) => {
    const item = contributions.find(c => c.id === contributionId);
    Alert.alert(
      'Reject contribution',
      `Reject ${item?.user?.name ?? 'member'}'s payment? They will be notified to resubmit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing({ id: contributionId, action: 'reject' });
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) { navigation.navigate('Signin'); return; }

              await axios.put(
                `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/contributions/${contributionId}/reject`,
                {},
                { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
              );

              setContributions(prev =>
                prev.map(c => c.id === contributionId ? { ...c, status: 'rejected' } : c),
              );
              setSelectedItem(prev => prev?.id === contributionId ? { ...prev, status: 'rejected' as const } : prev);
              setDetailVisible(false);
            } catch (err: any) {
              if (err?.response?.status === 401) { navigation.navigate('Signin'); return; }
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to reject. Please try again.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  // ── Filtered list ──
  const ownContribs = member_only && currentUserId
    ? contributions.filter(c => c.user_id === currentUserId)
    : contributions;
  const displayed = filter === 'all'
    ? ownContribs
    : ownContribs.filter(c => c.status === filter);

  const pendingCount = contributions.filter(c => c.status === 'pending' || c.status === 'under_review').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={D.textSub} />
        </TouchableOpacity>
        <View style={styles.navMid}>
          <Text style={styles.navTitle}>{member_only ? 'My Contributions' : 'Contributions'}</Text>
          <Text style={styles.navSub} numberOfLines={1}>{group_title}</Text>
        </View>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: 'rgba(0,214,143,0.10)', borderColor: 'rgba(0,214,143,0.25)' }]}
          onPress={() => loadContributions(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={17} color={D.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Stats banner ── */}
      {!loading && ownContribs.length > 0 && (
        <View style={styles.statsBanner}>
          {[
            { label: 'Total',    value: String(ownContribs.length),                                        color: D.textSub },
            { label: 'Pending',  value: String(ownContribs.filter(c => c.status === 'pending' || c.status === 'under_review').length), color: pendingCount > 0 ? D.warn : D.textSub },
            { label: 'Verified', value: String(ownContribs.filter(c => c.status === 'verified').length),   color: D.primary },
            { label: 'Rejected', value: String(ownContribs.filter(c => c.status === 'rejected').length),   color: D.danger },
          ].map(stat => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScrollView}
      >
        {FILTERS.map(f => {
          const isActive = filter === f.key;
          const count = f.key === 'all'
            ? ownContribs.length
            : ownContribs.filter(c => c.status === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={D.primary} />
          <Text style={styles.loadingText}>Loading contributions…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadContributions(true); }}
              tintColor={D.primary}
            />
          }
        >
          {displayed.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={32} color={D.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? (member_only ? 'No contributions yet' : 'No contributions yet') : `No ${filter.replace('_', ' ')} contributions`}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? (member_only ? 'Your contributions to this group will appear here' : 'Member contributions will appear here once submitted')
                  : 'Try a different filter to see other submissions'}
              </Text>
            </View>
          ) : (
            <>
              {pendingCount > 0 && filter === 'all' && !member_only && (
                <View style={styles.actionRequiredBanner}>
                  <LinearGradient
                    colors={['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.06)']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Ionicons name="alert-circle-outline" size={16} color={D.warn} />
                  <Text style={styles.actionRequiredText}>
                    {pendingCount} contribution{pendingCount !== 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} your review
                  </Text>
                </View>
              )}
              {displayed.map(item => (
                <ContributionCard
                  key={item.id}
                  item={item}
                  onPress={openDetail}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  processing={processing?.id === item.id ? processing.action : null}
                  readOnly={member_only}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <DetailModal
        item={selectedItem}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        processing={selectedItem && processing?.id === selectedItem.id ? processing.action : null}
        readOnly={member_only}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  // ── Navbar ──
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
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
  navMid: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700', color: D.text },
  navSub: { fontSize: 11, color: D.textMuted, marginTop: 1 },

  // ── Stats banner ──
  statsBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: D.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: D.border,
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderRightWidth: 1,
    borderRightColor: D.border,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: D.textMuted, fontWeight: '500' },

  // ── Filter tabs ──
  filterScrollView: { maxHeight: 48, marginBottom: 4 },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: D.surfaceCard,
    borderWidth: 1,
    borderColor: D.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(0,214,143,0.12)',
    borderColor: 'rgba(0,214,143,0.35)',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: D.textSub },
  filterChipTextActive: { color: D.primary },
  filterCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: D.surface,
    alignItems: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(0,214,143,0.20)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: D.textMuted },
  filterCountTextActive: { color: D.primary },

  // ── List ──
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 12,
  },

  // ── Action required banner ──
  actionRequiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  actionRequiredText: {
    fontSize: 13,
    fontWeight: '600',
    color: D.warn,
    flex: 1,
  },

  // ── Loading / empty ──
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: D.textMuted },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: D.textSub },
  emptyText: { fontSize: 13, color: D.textMuted, textAlign: 'center', maxWidth: 240, lineHeight: 18 },
});
