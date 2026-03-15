import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

// ── Dark theme tokens ──────────────────────────────────────────────────────────
const P = {
  bg:         '#0e0f17',
  surface:    '#161821',
  surfaceHi:  '#1e2030',
  border:     '#2a2d3e',
  borderHi:   '#3d4160',
  text:       '#e8eaf6',
  textSub:    '#8b8fa8',
  textMuted:  '#555870',
  accent:     '#7c8cff',
  accentSoft: 'rgba(124,140,255,0.094)',
  accentMed:  'rgba(124,140,255,0.2)',
  accent2:    '#38d9a9',
  accent2Soft:'rgba(56,217,169,0.094)',
  warn:       '#ffa94d',
  warnSoft:   'rgba(255,169,77,0.082)',
};

// ── Per-plan config ────────────────────────────────────────────────────────────
type PlanKey = 'starter' | 'growth' | 'enterprise';

interface PlanConfig {
  name: string;
  tagline: string;
  price: string;
  period: string;
  popular?: boolean;
  accentColor: string;
  accentSoft: string;
  checkBg: string;
  ctaGrad: readonly [string, string];
  ctaGlow: string;
  footerNote: string;
  label: string;
  confirmTitle: string;
  confirmBody: string;
  features: string[];
  builtFor?: string[];
}

const PLANS: Record<PlanKey, PlanConfig> = {
  starter: {
    name:         'Starter',
    tagline:      'Begin growing',
    price:        'Free',
    period:       'forever',
    accentColor:  '#38d9a9',
    accentSoft:   'rgba(56,217,169,0.094)',
    checkBg:      'rgba(56,217,169,0.125)',
    ctaGrad:      ['#38d9a9', '#20b087'],
    ctaGlow:      'rgba(56,217,169,0.267)',
    footerNote:   'No credit card needed',
    label:        'Get started for free',
    confirmTitle: 'Starter activated',
    confirmBody:  "You're on the free Starter plan. Create your first group and start saving together.",
    features: [
      '1 active savings group',
      'Up to 5 members',
      'Basic contribution tracking',
      'Shared transparent ledger',
      'Email notifications',
      'Reward-based unlocks',
    ],
  },
  growth: {
    name:         'Growth',
    tagline:      'Scale your Ajo',
    price:        '£4.99',
    period:       'per month',
    popular:      true,
    accentColor:  '#7c8cff',
    accentSoft:   'rgba(124,140,255,0.094)',
    checkBg:      'rgba(124,140,255,0.125)',
    ctaGrad:      ['#7c8cff', '#9b59d4'],
    ctaGlow:      'rgba(124,140,255,0.267)',
    footerNote:   'Cancel any time',
    label:        'Start Growth plan',
    confirmTitle: 'Growth plan activated',
    confirmBody:  'Unlimited groups, smart reminders and the full analytics dashboard are now available.',
    features: [
      'Everything in Starter',
      'Unlimited groups',
      'Up to 20 members per group',
      'Smart automated reminders',
      'Advanced analytics dashboard',
      'Detailed trust score insights',
      'Export reports (PDF / CSV)',
      'Zero ads · Priority support',
    ],
  },
  enterprise: {
    name:         'Enterprise',
    tagline:      'Lead your community',
    price:        '£199',
    period:       'per year',
    accentColor:  '#ffa94d',
    accentSoft:   'rgba(255,169,77,0.082)',
    checkBg:      'rgba(255,169,77,0.125)',
    ctaGrad:      ['#ffa94d', '#e07a10'],
    ctaGlow:      'rgba(255,169,77,0.267)',
    footerNote:   'Billed annually',
    label:        'Get Enterprise access',
    confirmTitle: 'Enterprise confirmed',
    confirmBody:  'Your account manager will reach out within 24 hours to complete your onboarding.',
    features: [
      'Everything in Growth',
      'Unlimited members',
      'Custom branding',
      'Organisation-wide dashboard',
      'Multi-group oversight tools',
      'Dedicated account manager',
    ],
    builtFor: [
      'Community associations',
      'Churches & cultural orgs',
      'Migrant support groups',
      'Savings cooperatives',
    ],
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const FeatRow: React.FC<{ text: string; checkBg: string; accentColor: string }> = ({
  text, checkBg, accentColor,
}) => (
  <View style={styles.featRow}>
    <View style={[styles.checkCircle, { backgroundColor: checkBg }]}>
      <Text style={[styles.checkMark, { color: accentColor }]}>✓</Text>
    </View>
    <Text style={styles.featText}>{text}</Text>
  </View>
);

// ── Plan Card ──────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{
  planKey: PlanKey;
  plan: PlanConfig;
  selected: PlanKey | null;
  onSelect: (key: PlanKey) => void;
}> = ({ planKey, plan, selected, onSelect }) => {
  const isSelected = selected === planKey;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(planKey)}
      style={[
        styles.planCard,
        {
          borderColor:   isSelected ? plan.accentColor : P.border,
          borderWidth:   isSelected ? 2 : 1,
          ...Platform.select({
            ios:     { shadowColor: isSelected ? plan.accentColor : 'transparent' },
            android: { elevation: isSelected ? 6 : 2 },
          }),
        },
      ]}
    >
      {/* Head */}
      <View style={styles.planHead}>
        <View style={styles.planHeadLeft}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planTagline}>{plan.tagline}</Text>
        </View>
        <View style={styles.planPriceBox}>
          <Text style={[styles.planPrice, { color: plan.accentColor }]}>{plan.price}</Text>
          <Text style={styles.planPeriod}>{plan.period}</Text>
        </View>
      </View>

      {/* Popular badge */}
      {plan.popular && (
        <View style={styles.popularBadgeRow}>
          <View style={[styles.popularBadge, { backgroundColor: P.accentSoft, borderColor: P.accentMed }]}>
            <Text style={[styles.popularBadgeText, { color: P.accent }]}>Most popular</Text>
          </View>
        </View>
      )}

      {/* Features */}
      <View style={styles.planFeatures}>
        {plan.features.map((f) => (
          <FeatRow key={f} text={f} checkBg={plan.checkBg} accentColor={plan.accentColor} />
        ))}
      </View>

      {/* Built for — Enterprise only */}
      {plan.builtFor && (
        <View style={styles.builtForSection}>
          <Text style={styles.builtForLabel}>BUILT FOR</Text>
          <View style={styles.builtForChips}>
            {plan.builtFor.map((c) => (
              <View key={c} style={styles.builtForChip}>
                <Text style={styles.builtForChipText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.planFooter}>
        <Text style={styles.planFooterNote}>{plan.footerNote}</Text>
        <View
          style={[
            styles.radioDot,
            {
              borderColor:     isSelected ? plan.accentColor : P.border,
              backgroundColor: isSelected ? plan.accentColor : 'transparent',
              ...Platform.select({
                ios:     { shadowColor: isSelected ? plan.accentColor : 'transparent', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
                android: { elevation: isSelected ? 3 : 0 },
              }),
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

// ── Navigation params ──────────────────────────────────────────────────────────

type RootStackParamList = {
  Dashboard: undefined;
  PlanPicker: undefined;
};

// ── Main Screen ────────────────────────────────────────────────────────────────

const PlanPickerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets    = useSafeAreaInsets();

  const [selected,  setSelected]  = useState<PlanKey | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const activePlan = selected ? PLANS[selected] : null;

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.apiUrl;
      const token  = await AsyncStorage.getItem('token');
      await axios.post(
        `${apiUrl}/user/plan/subscribe`,
        { plan: selected },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch {
      // Show confirmation optimistically — server will sync the plan
    } finally {
      setLoading(false);
      setConfirmed(true);
    }
  };

  const goToDashboard = () =>
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (confirmed && activePlan) {
    return (
      <View style={[styles.confirmRoot, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar barStyle="light-content" backgroundColor={P.bg} />

        <View style={[
          styles.confirmIconWrap,
          { backgroundColor: activePlan.accentSoft, borderColor: `${activePlan.accentColor}55` },
        ]}>
          <Text style={{ fontSize: 30, color: activePlan.accentColor }}>✓</Text>
        </View>

        <Text style={styles.confirmTitle}>{activePlan.confirmTitle}</Text>
        <Text style={styles.confirmBody}>{activePlan.confirmBody}</Text>

        <View style={[styles.confirmPlanPill, { borderColor: `${activePlan.accentColor}30` }]}>
          <Text style={[styles.confirmPlanName, { color: activePlan.accentColor }]}>
            {activePlan.name}
          </Text>
          <View style={styles.confirmPillDivider} />
          <Text style={styles.confirmPlanPrice}>
            {activePlan.price}
            {activePlan.period !== 'forever' ? ` · ${activePlan.period}` : ''}
          </Text>
        </View>

        <TouchableOpacity style={styles.confirmCta} onPress={goToDashboard}>
          <LinearGradient
            colors={activePlan.ctaGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmCtaGrad}
          >
            <Text style={styles.confirmCtaText}>Go to Dashboard</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { setConfirmed(false); setSelected(null); }}
        >
          <Text style={styles.backBtnText}>← Back to plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Plan picker ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={P.bg} />

      {/* Header gradient */}
      <LinearGradient
        colors={['#1a1c3a', '#2a1850']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={[styles.headerIcon, { backgroundColor: P.accentSoft, borderColor: P.accentMed }]}>
          <Text style={styles.headerIconEmoji}>⭐</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Choose your plan</Text>
          <Text style={styles.headerSubtitle}>
            Pick the plan that fits your savings community
          </Text>
        </View>
      </LinearGradient>

      {/* Scrollable plan list + CTA */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {(Object.entries(PLANS) as [PlanKey, PlanConfig][]).map(([key, plan]) => (
          <PlanCard
            key={key}
            planKey={key}
            plan={plan}
            selected={selected}
            onSelect={setSelected}
          />
        ))}

        {/* CTA button */}
        <TouchableOpacity
          disabled={!selected || loading}
          onPress={handleConfirm}
          activeOpacity={selected ? 0.85 : 1}
          style={styles.ctaWrapper}
        >
          {selected && activePlan ? (
            <LinearGradient
              colors={activePlan.ctaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.ctaText}>{activePlan.label}</Text>
              }
            </LinearGradient>
          ) : (
            <View style={[styles.ctaButton, styles.ctaDisabled]}>
              <Text style={styles.ctaTextDisabled}>Select a plan to continue</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick-start free link */}
        <View style={styles.skipRow}>
          <Text style={styles.skipText}>Not sure?{'  '}</Text>
          <TouchableOpacity onPress={() => setSelected('starter')}>
            <Text style={styles.skipLink}>Start free with Starter</Text>
          </TouchableOpacity>
        </View>

        {/* Skip entirely */}
        <TouchableOpacity style={styles.skipDashBtn} onPress={goToDashboard}>
          <Text style={styles.skipDashText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default PlanPickerScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           13,
    paddingHorizontal: 20,
    paddingVertical:   22,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  headerIcon: {
    width:          46,
    height:         46,
    borderRadius:   15,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  headerIconEmoji: {
    fontSize: 18,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize:      18,
    fontWeight:    '800',
    color:         P.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize:  12,
    color:     P.textMuted,
    marginTop: 3,
  },

  // ── Scroll list ──────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop:        16,
  },

  // ── Plan card ────────────────────────────────────────────────────────────────
  planCard: {
    backgroundColor: P.surface,
    borderRadius:    18,
    marginBottom:    12,
    overflow:        'hidden',
    ...Platform.select({
      ios: {
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius:  14,
      },
      android: {},
    }),
  },
  planHead: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    padding:        18,
    paddingBottom:  14,
    gap:            12,
  },
  planHeadLeft: {
    flex: 1,
  },
  planName: {
    fontSize:   16,
    fontWeight: '800',
    color:      P.text,
  },
  planTagline: {
    fontSize:  12,
    color:     P.textMuted,
    marginTop: 3,
  },
  planPriceBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  planPrice: {
    fontSize:   22,
    fontWeight: '800',
  },
  planPeriod: {
    fontSize:  11,
    color:     P.textMuted,
    marginTop: 2,
  },
  popularBadgeRow: {
    paddingHorizontal: 18,
    paddingBottom:     12,
  },
  popularBadge: {
    alignSelf:        'flex-start',
    borderWidth:      1,
    borderRadius:     20,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  popularBadgeText: {
    fontSize:   10,
    fontWeight: '700',
  },
  planFeatures: {
    borderTopWidth: 1,
    borderTopColor: P.border,
    paddingHorizontal: 18,
    paddingVertical:   13,
  },
  featRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           9,
    paddingVertical: 4,
  },
  checkCircle: {
    width:          16,
    height:         16,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    marginTop:      1,
  },
  checkMark: {
    fontSize:   9,
    fontWeight: '700',
  },
  featText: {
    flex:       1,
    fontSize:   13,
    color:      P.textSub,
    lineHeight: 20,
  },
  builtForSection: {
    paddingHorizontal: 18,
    paddingBottom:     14,
  },
  builtForLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         P.textMuted,
    letterSpacing: 0.8,
    marginBottom:  8,
  },
  builtForChips: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            5,
  },
  builtForChip: {
    borderWidth:       1,
    borderColor:       P.border,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   3,
    backgroundColor:   P.surfaceHi,
  },
  builtForChipText: {
    fontSize: 11,
    color:    P.textMuted,
  },
  planFooter: {
    borderTopWidth:    1,
    borderTopColor:    P.border,
    paddingHorizontal: 18,
    paddingVertical:   12,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  planFooterNote: {
    fontSize: 11,
    color:    P.textMuted,
  },
  radioDot: {
    width:        20,
    height:       20,
    borderRadius: 10,
    borderWidth:  2,
  },

  // ── CTA ──────────────────────────────────────────────────────────────────────
  ctaWrapper: {
    marginTop:    4,
    marginBottom: 4,
  },
  ctaButton: {
    borderRadius:   16,
    paddingVertical: 15,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: P.surfaceHi,
  },
  ctaText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#fff',
  },
  ctaTextDisabled: {
    fontSize:   15,
    fontWeight: '700',
    color:      P.textMuted,
  },

  // ── Skip links ───────────────────────────────────────────────────────────────
  skipRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      16,
  },
  skipText: {
    fontSize: 12,
    color:    P.textMuted,
  },
  skipLink: {
    fontSize:   12,
    color:      P.accent,
    fontWeight: '700',
  },
  skipDashBtn: {
    alignItems:    'center',
    marginTop:     10,
    paddingVertical: 8,
  },
  skipDashText: {
    fontSize: 12,
    color:    P.textMuted,
  },

  // ── Confirmation screen ───────────────────────────────────────────────────────
  confirmRoot: {
    flex:            1,
    backgroundColor: P.bg,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 24,
  },
  confirmIconWrap: {
    width:          72,
    height:         72,
    borderRadius:   22,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   22,
  },
  confirmTitle: {
    fontSize:      22,
    fontWeight:    '800',
    color:         P.text,
    marginBottom:  10,
    letterSpacing: -0.5,
    textAlign:     'center',
  },
  confirmBody: {
    fontSize:    14,
    color:       P.textSub,
    lineHeight:  23,
    maxWidth:    300,
    textAlign:   'center',
    marginBottom: 28,
  },
  confirmPlanPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:               14,
    backgroundColor:  P.surface,
    borderWidth:      1,
    borderRadius:     14,
    paddingHorizontal: 22,
    paddingVertical:   12,
    marginBottom:     28,
  },
  confirmPlanName: {
    fontSize:   15,
    fontWeight: '800',
  },
  confirmPillDivider: {
    width:           1,
    height:          16,
    backgroundColor: P.border,
  },
  confirmPlanPrice: {
    fontSize: 13,
    color:    P.textMuted,
  },
  confirmCta: {
    width:        '100%',
    marginBottom: 12,
  },
  confirmCtaGrad: {
    borderRadius:    16,
    paddingVertical: 15,
    alignItems:      'center',
  },
  confirmCtaText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#fff',
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical:   11,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       P.border,
  },
  backBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      P.textSub,
  },
});
