import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  q: string;
  a: string;
}

interface Category {
  id: string;
  icon: string;
  label: string;
  color: string;
  grad: readonly [string, string];
  desc: string;
  articles: Article[];
}

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_review' | 'awaiting' | 'escalated' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  date: string;
  updated: string;
  category?: string;
  message?: string;
}

type ScreenType = 'hub' | 'category' | 'new-ticket' | 'my-tickets' | 'ticket-detail' | 'ticket-success';

// ─── API Configuration ────────────────────────────────────────────────────────

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://api.groupsave.app/api';

// Helper to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// API response type
interface ApiResponse<T> {
  data?: T;
  status?: string;
  message?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

const SupportAPI = {
  // Public endpoints
  getFAQ: async (): Promise<Category[]> => {
    const response = await axios.get<ApiResponse<Category[]>>(`${API_BASE_URL}/support/faq`);
    return response.data.data || (response.data as unknown as Category[]);
  },

  searchFAQ: async (query: string): Promise<Category[]> => {
    const response = await axios.get<ApiResponse<Category[]>>(`${API_BASE_URL}/support/faq/search`, {
      params: { q: query },
    });
    return response.data.data || (response.data as unknown as Category[]);
  },

  getFAQBySlug: async (slug: string): Promise<Category> => {
    const response = await axios.get<ApiResponse<Category>>(`${API_BASE_URL}/support/faq/${slug}`);
    return response.data.data || (response.data as unknown as Category);
  },

  submitFAQFeedback: async (faqId: string, helpful: boolean): Promise<void> => {
    await axios.post(`${API_BASE_URL}/support/faq/${faqId}/feedback`, { helpful });
  },

  getContactInfo: async (): Promise<{ email: string; phone?: string; sla?: Record<string, string> }> => {
    const response = await axios.get<ApiResponse<{ email: string; phone?: string; sla?: Record<string, string> }>>(`${API_BASE_URL}/support/contact`);
    return response.data.data || (response.data as unknown as { email: string; phone?: string; sla?: Record<string, string> });
  },

  // Authenticated endpoints
  getTickets: async (): Promise<Ticket[]> => {
    const headers = await getAuthHeaders();
    const response = await axios.get<ApiResponse<Ticket[]>>(`${API_BASE_URL}/user/support/tickets`, { headers });
    return response.data.data || (response.data as unknown as Ticket[]);
  },

  createTicket: async (data: {
    subject: string;
    category: string;
    priority: string;
    message: string;
  }): Promise<{ id: string; subject: string }> => {
    const headers = await getAuthHeaders();
    const response = await axios.post<ApiResponse<{ id: string; subject: string }>>(`${API_BASE_URL}/user/support/tickets`, data, { headers });
    return response.data.data || (response.data as unknown as { id: string; subject: string });
  },

  getTicketById: async (ticketId: string): Promise<Ticket & { messages?: Array<{ sender: string; text: string; date: string }> }> => {
    const headers = await getAuthHeaders();
    type TicketDetail = Ticket & { messages?: Array<{ sender: string; text: string; date: string }> };
    const response = await axios.get<ApiResponse<TicketDetail>>(`${API_BASE_URL}/user/support/tickets/${ticketId}`, { headers });
    return response.data.data || (response.data as unknown as TicketDetail);
  },

  replyToTicket: async (ticketId: string, message: string): Promise<void> => {
    const headers = await getAuthHeaders();
    await axios.post(`${API_BASE_URL}/user/support/tickets/${ticketId}/reply`, { message }, { headers });
  },

  escalateTicket: async (ticketId: string): Promise<void> => {
    const headers = await getAuthHeaders();
    await axios.post(`${API_BASE_URL}/user/support/tickets/${ticketId}/escalate`, {}, { headers });
  },

  submitTicketFeedback: async (ticketId: string, helpful: boolean): Promise<void> => {
    const headers = await getAuthHeaders();
    await axios.post(`${API_BASE_URL}/user/support/tickets/${ticketId}/feedback`, { helpful }, { headers });
  },
};

// ─── FAQ Fallback Data ────────────────────────────────────────────────────────

const CATEGORIES_FALLBACK: Category[] = [
  {
    id: 'account',
    icon: '🔐',
    label: 'Account & Security',
    color: D.purple,
    grad: ['#2d1a70', '#1a1040'] as const,
    desc: 'Password, 2FA, login issues',
    articles: [
      { q: 'How do I reset my password?', a: "Tap 'Forgot password?' on the sign-in screen. Enter your registered email and we'll send a 6-digit reset code. Enter the code and choose a new password. The code expires in 24 hours." },
      { q: 'How do I verify my email?', a: "After signing up, check your inbox for a verification email. Click the link or enter the 6-digit code. If not received, tap 'Resend code' on the verification screen." },
      { q: 'How do I enable Two-Factor Authentication?', a: 'Go to Profile → Settings → Security → Two-Factor Auth. Link your mobile number or authenticator app. 2FA is strongly recommended for protecting your savings.' },
      { q: 'I see a suspicious login — what do I do?', a: "Immediately change your password via Profile → Security. Then contact support@groupsave.app flagged 'Urgent – Security'. We'll investigate and freeze the account if needed." },
      { q: 'How do I change my email or phone number?', a: 'Go to Profile → Edit Profile. Update your email or mobile. A verification code will confirm the change before it takes effect.' },
    ],
  },
  {
    id: 'groups',
    icon: '👥',
    label: 'Savings Groups',
    color: D.accent,
    grad: ['#1a2060', '#0e1540'] as const,
    desc: 'Creating, managing and leaving groups',
    articles: [
      { q: 'How do I create a savings group?', a: "Tap '+' on the Groups screen. Enter the group name, target amount, number of members, start date, and monthly payment day. Invite members by email — they'll receive an invitation." },
      { q: 'How do I invite members?', a: "When creating a group or from the Members tab, enter members' email addresses. They receive an invitation and once accepted, their status changes from Pending to Active." },
      { q: 'What happens if a member misses a payment?', a: "The group admin is notified. The member's status is flagged. Late contributions are still accepted — the system logs all payments with timestamps." },
      { q: 'Can I remove a member from my group?', a: "Yes, if you're the group admin. Group → Members → tap the member → Remove. They'll be notified by email. Their payout position is forfeited." },
      { q: 'What happens if I leave a group mid-cycle?', a: "Contact your admin first. If you've received a payout, leaving mid-cycle affects other members. Open a support ticket if you need mediation." },
    ],
  },
  {
    id: 'payments',
    icon: '💳',
    label: 'Payments & Contributions',
    color: D.accent2,
    grad: ['#0d2820', '#071a14'] as const,
    desc: 'Making payments, failed transactions, disputes',
    articles: [
      { q: 'How do I make my monthly contribution?', a: "Go to your group → Tap 'Pay Now'. Select your payment method and confirm. You'll receive a confirmation email and group progress updates immediately." },
      { q: 'My payment failed — what do I do?', a: 'Check your bank details and ensure sufficient funds. Try again after a few minutes. If it continues, contact support@groupsave.app with your transaction reference number.' },
      { q: 'I was charged twice — how do I get a refund?', a: "Email support@groupsave.app with subject 'Duplicate Payment'. Attach your bank statement. Our team investigates within 48 hours and processes refunds within 3–5 business days." },
      { q: 'Can I pay early?', a: "Yes! Early payments are accepted any time. Your contribution is reflected immediately in the group's progress dashboard with the correct timestamp." },
    ],
  },
  {
    id: 'payouts',
    icon: '💰',
    label: 'Withdrawals & Payouts',
    color: D.warn,
    grad: ['#2d1f08', '#1a1204'] as const,
    desc: 'Payout schedules, delays, early withdrawal',
    articles: [
      { q: 'How is the payout schedule determined?', a: 'Payout positions are assigned when the group is created, typically by agreement between members. Each member receives the full pot once during the savings cycle.' },
      { q: 'When will I receive my payout?', a: "Payouts are processed on the group's payment day. You'll be notified 3 days before. Funds typically arrive within 1–2 business days after processing." },
      { q: 'Can I request an early payout?', a: 'Early payout requests require admin approval. Submit via group page → Request Early Payout. The admin reviews within 48 hours.' },
      { q: 'My payout is delayed — what should I do?', a: "Allow up to 3 business days from your payout date. If still not received, open a ticket flagged 'High – Payment Delay' with your group ID and payout date." },
    ],
  },
  {
    id: 'notifications',
    icon: '🔔',
    label: 'Notifications',
    color: D.purple,
    grad: ['#2a1060', '#180a40'] as const,
    desc: 'Alerts, reminders & notification settings',
    articles: [
      { q: 'How do I manage my notifications?', a: 'Go to Profile → Settings → Notifications. Toggle push, email, and SMS individually. Control payment reminders, group updates, and invitation alerts separately.' },
      { q: "I'm not receiving email notifications", a: 'Check your spam/junk folder. Add support@groupsave.app to your contacts. Ensure your email is verified in Profile → Settings.' },
      { q: 'Can I set custom payment reminders?', a: 'Yes. In Settings → Notifications → Payment Reminders, choose 1, 3, or 7 days before your payment is due.' },
    ],
  },
  {
    id: 'technical',
    icon: '🛠️',
    label: 'Technical Issues',
    color: D.accent2,
    grad: ['#0d2820', '#071a14'] as const,
    desc: 'Crashes, sync errors & troubleshooting',
    articles: [
      { q: 'The app keeps crashing', a: 'Force close and reopen. Check for updates in the App Store / Play Store. Uninstall and reinstall if needed. Contact support with your device model and OS version.' },
      { q: "My dashboard data isn't syncing", a: 'Pull down to refresh. Log out and back in. If data mismatch persists after 24 hours, open a ticket with a screenshot of the incorrect data.' },
      { q: 'My account is suspended', a: "Suspensions are triggered by suspicious activity or policy violations. Email support@groupsave.app with subject 'Suspension Appeal'. We review within 24 hours." },
    ],
  },
  {
    id: 'fraud',
    icon: '🚨',
    label: 'Fraud & Safety',
    color: D.danger,
    grad: ['#2d0808', '#1a0404'] as const,
    desc: 'Report fraud, disputes & suspicious activity',
    articles: [
      { q: 'How do I report a fraudulent group admin?', a: "Email support@groupsave.app immediately. Subject: 'URGENT – Fraud Report'. Include the group name, admin email, and description. Our compliance team responds within 6 hours." },
      { q: "What is GroupSave's fraud monitoring policy?", a: 'We employ automated suspicious activity monitoring. High-risk actions trigger manual review. All transactions are logged, timestamped, and auditable by our compliance team.' },
      { q: 'What if my identity was misused?', a: "Contact us immediately at support@groupsave.app. We'll freeze the affected account, investigate, and work with you to restore access and resolve any financial impact." },
    ],
  },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: D.accent, bg: D.accentSoft },
  in_review: { label: 'In Review', color: D.warn, bg: D.warnSoft },
  awaiting: { label: 'Awaiting', color: D.purple, bg: D.purpleSoft },
  escalated: { label: 'Escalated', color: D.danger, bg: D.dangerSoft },
  resolved: { label: 'Resolved', color: D.accent2, bg: D.accent2Soft },
  closed: { label: 'Closed', color: D.textMuted, bg: 'rgba(74,80,112,0.15)' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: D.textMuted },
  medium: { label: 'Medium', color: D.accent },
  high: { label: 'High', color: D.warn },
  critical: { label: 'Critical', color: D.danger },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Toast Component ──────────────────────────────────────────────────────────

const ToastMessage: React.FC<{ msg: string | null }> = ({ msg }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (msg) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [msg, opacity, translateY]);

  if (!msg) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Ionicons name="checkmark-circle" size={18} color={D.accent2} />
      <Text style={styles.toastText}>{msg}</Text>
    </Animated.View>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: Ticket['status'] }> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.color + '25' }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// ─── SlideIn Animation Wrapper ────────────────────────────────────────────────

const SlideIn: React.FC<{ visible: boolean; children: React.ReactNode }> = ({ visible, children }) => {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateX, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.slideIn, { transform: [{ translateX }], opacity }]}>
      {children}
    </Animated.View>
  );
};

// ─── Card Component ───────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ─── Section Label ────────────────────────────────────────────────────────────

const SecLabel: React.FC<{ text: string; action?: string; onAction?: () => void }> = ({
  text,
  action,
  onAction,
}) => (
  <View style={styles.secLabelRow}>
    <Text style={styles.secLabel}>{text}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={styles.secLabelAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Back Button ──────────────────────────────────────────────────────────────

const BackBtn: React.FC<{ onBack: () => void; light?: boolean }> = ({ onBack, light = true }) => (
  <TouchableOpacity
    style={[styles.backBtn, light ? styles.backBtnLight : styles.backBtnDark]}
    onPress={onBack}
  >
    <Ionicons name="arrow-back" size={16} color={light ? '#fff' : D.textSub} />
    <Text style={[styles.backBtnText, { color: light ? '#fff' : D.textSub }]}>Back</Text>
  </TouchableOpacity>
);

// ─── Primary Button ───────────────────────────────────────────────────────────

const Btn: React.FC<{
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'warn' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: object;
}> = ({ children, onPress, variant = 'primary', disabled, style }) => {
  const gradients: Record<string, readonly [string, string]> = {
    primary: D.gradientAccent,
    success: D.gradientSuccess,
    warn: [D.warn, '#e07b20'] as const,
    danger: [D.danger, '#c0392b'] as const,
  };

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        style={[styles.btnGhost, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.btnGhostText}>{children}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={style}>
      <LinearGradient
        colors={disabled ? [D.border, D.border] : gradients[variant] || D.gradientAccent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, disabled && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>{children}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HUB VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface HubProps {
  nav: (screen: ScreenType, ctx?: any) => void;
  insets: { top: number; bottom: number };
}

const HubView: React.FC<HubProps> = ({ nav, insets }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ q: string; a: string; cat: Category }>>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch FAQ categories on mount
  useEffect(() => {
    const fetchFAQ = async () => {
      try {
        setLoading(true);
        const data = await SupportAPI.getFAQ();
        if (data && data.length > 0) {
          setCategories(data);
        }
      } catch (error) {
        console.warn('Failed to fetch FAQ, using fallback data:', error);
        // Keep fallback data
      } finally {
        setLoading(false);
      }
    };
    fetchFAQ();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length > 1) {
      setSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const data = await SupportAPI.searchFAQ(query);
          // Transform API results to expected format
          const results = data.flatMap((c) =>
            c.articles
              .filter((a) => a.q.toLowerCase().includes(query.toLowerCase()))
              .map((a) => ({ ...a, cat: c }))
          );
          setSearchResults(results);
        } catch (error) {
          // Fallback to local search
          const localResults = categories.flatMap((c) =>
            c.articles
              .filter((a) => a.q.toLowerCase().includes(query.toLowerCase()))
              .map((a) => ({ ...a, cat: c }))
          );
          setSearchResults(localResults);
        } finally {
          setSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, categories]);

  const results = query.trim().length > 1 ? searchResults : [];

  return (
    <ScrollView style={styles.hubContainer} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#1a1f3e', D.bg]} style={[styles.hubHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.hubHeaderCircle1} />
        <View style={styles.hubHeaderCircle2} />
        <Text style={styles.hubHeaderIcon}>🛟</Text>

        <Text style={styles.hubTitle}>Help & Support</Text>
        <Text style={styles.hubSubtitle}>How can we help you today?</Text>

        {/* Search */}
        <View style={[styles.searchWrap, focused && styles.searchWrapFocused]}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search articles, topics..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.hubContent}>
        {/* Search Results */}
        {query.trim().length > 1 && (
          <View style={styles.searchResults}>
            <SecLabel text={searching ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`} />
            {searching ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={D.accent} />
              </View>
            ) : results.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 38, marginBottom: 12 }}>🤷</Text>
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>Try different words or browse categories below</Text>
                <TouchableOpacity
                  onPress={() => nav('new-ticket')}
                  style={[styles.miniBtn, { marginTop: 16 }]}
                >
                  <Text style={styles.miniBtnText}>Submit a Ticket</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              results.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchResultItem}
                  onPress={() => nav('category', { cat: a.cat, expandArticle: a.q })}
                >
                  <View style={[styles.searchResultIcon, { backgroundColor: a.cat.color + '20' }]}>
                    <Text style={{ fontSize: 16 }}>{a.cat.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultQ} numberOfLines={1}>
                      {a.q}
                    </Text>
                    <Text style={styles.searchResultCat}>{a.cat.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={D.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {!query && (
          <>
            {/* Quick Actions */}
            <SecLabel text="Quick Actions" />
            <View style={styles.quickActionsRow}>
              {[
                { icon: '📩', label: 'New Ticket', sub: 'Submit a request', color: D.accent, act: () => nav('new-ticket') },
                { icon: '🎫', label: 'My Tickets', sub: 'Track requests', color: D.accent2, act: () => nav('my-tickets') },
                { icon: '🚨', label: 'Urgent', sub: 'Critical issue', color: D.danger, act: () => nav('new-ticket', { priority: 'critical' }) },
              ].map((q) => (
                <TouchableOpacity key={q.label} style={[styles.quickActionCard, { borderColor: q.color + '25' }]} onPress={q.act}>
                  <Text style={{ fontSize: 22, marginBottom: 7 }}>{q.icon}</Text>
                  <Text style={styles.quickActionLabel}>{q.label}</Text>
                  <Text style={styles.quickActionSub}>{q.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contact Channels */}
            <SecLabel text="Contact Us" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {[
                { icon: '📧', label: 'Email Support', sub: 'support@groupsave.app', note: '24–48hr', color: D.accent, act: true },
                { icon: '💬', label: 'Live Chat', sub: 'Real-time assistance', note: 'Coming soon', color: D.accent2, act: false },
                { icon: '🚨', label: 'Critical Escalation', sub: 'Payment or security issues', note: '6–12hr', color: D.danger, act: true },
              ].map((c, i, arr) => (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.contactRow, i < arr.length - 1 && styles.contactRowBorder]}
                  onPress={c.act ? () => nav('new-ticket', { priority: i === 2 ? 'critical' : 'medium' }) : undefined}
                  disabled={!c.act}
                  activeOpacity={c.act ? 0.7 : 1}
                >
                  <View style={[styles.contactIcon, { backgroundColor: c.color + '18', borderColor: c.color + '25' }]}>
                    <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactLabel, !c.act && { opacity: 0.5 }]}>{c.label}</Text>
                    <Text style={[styles.contactSub, !c.act && { opacity: 0.5 }]} numberOfLines={1}>
                      {c.sub}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.noteBadge, { backgroundColor: c.color + '18' }]}>
                      <Text style={[styles.noteBadgeText, { color: c.color }]}>{c.note}</Text>
                    </View>
                    {c.act && <Ionicons name="chevron-forward" size={14} color={D.textMuted} />}
                  </View>
                </TouchableOpacity>
              ))}
            </Card>

            {/* Response Times */}
            <SecLabel text="Response Times" />
            <Card>
              {[
                { tier: '🆓 Starter Plan', sla: '24–48 hours', color: D.textMuted },
                { tier: '📈 Growth Plan', sla: '12–24 hours', color: D.accent },
                { tier: '🚨 Critical Issues', sla: '6–12 hours', color: D.danger },
              ].map((s, i, arr) => (
                <View key={s.tier} style={[styles.slaRow, i < arr.length - 1 && styles.slaRowBorder]}>
                  <Text style={styles.slaTier}>{s.tier}</Text>
                  <Text style={[styles.slaSla, { color: s.color }]}>{s.sla}</Text>
                </View>
              ))}
            </Card>

            {/* Categories */}
            <SecLabel text="Browse Help Topics" />
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={D.accent} />
                <Text style={{ color: D.textMuted, marginTop: 12, fontSize: 13 }}>Loading help topics...</Text>
              </View>
            ) : (
              categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryCard}
                  onPress={() => nav('category', { cat })}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color + '18', borderColor: cat.color + '28' }]}>
                    <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                    <Text style={styles.categoryDesc}>{cat.desc}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.articleCountBadge, { backgroundColor: cat.color + '15' }]}>
                      <Text style={[styles.articleCountText, { color: cat.color }]}>{cat.articles?.length || 0}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={D.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Legal */}
            <SecLabel text="Legal & Privacy" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {[
                { icon: '📄', label: 'Terms of Service' },
                { icon: '🔒', label: 'Privacy Policy' },
                { icon: '♻️', label: 'Refund Policy' },
                { icon: '🗑️', label: 'Delete My Data (GDPR)', color: D.danger },
              ].map((l, i, arr) => (
                <TouchableOpacity key={l.label} style={[styles.legalRow, i < arr.length - 1 && styles.legalRowBorder]}>
                  <Text style={{ fontSize: 17 }}>{l.icon}</Text>
                  <Text style={[styles.legalLabel, l.color && { color: l.color }]}>{l.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={D.textMuted} />
                </TouchableOpacity>
              ))}
            </Card>

            <Text style={styles.footerText}>GroupSave v1.0.0 · support@groupsave.app</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface CategoryViewProps {
  cat: Category;
  onBack: () => void;
  onArticle: () => void;
  expandArticle?: string;
  insets: { top: number; bottom: number };
}

const CategoryView: React.FC<CategoryViewProps> = ({ cat, onBack, onArticle, expandArticle, insets }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (expandArticle) {
      const idx = cat.articles.findIndex((a) => a.q === expandArticle);
      if (idx !== -1) setOpenIdx(idx);
    }
  }, [expandArticle, cat.articles]);

  const handleFeedback = async (articleIdx: number, helpful: boolean) => {
    try {
      // Use article index as ID for now - adjust based on actual API
      const articleId = `${cat.id}-${articleIdx}`;
      await SupportAPI.submitFAQFeedback(articleId, helpful);
      setFeedbackGiven((prev) => ({ ...prev, [articleIdx]: true }));
    } catch (error) {
      console.warn('Failed to submit FAQ feedback:', error);
      // Still mark as given for UX
      setFeedbackGiven((prev) => ({ ...prev, [articleIdx]: true }));
    }
  };

  return (
    <ScrollView style={styles.hubContainer} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={cat.grad} style={[styles.categoryHeader, { paddingTop: insets.top + 16 }]}>
        <BackBtn onBack={onBack} />
        <View style={styles.categoryHeaderContent}>
          <View style={[styles.categoryHeaderIcon, { backgroundColor: cat.color + '28', borderColor: cat.color + '40' }]}>
            <Text style={{ fontSize: 26 }}>{cat.icon}</Text>
          </View>
          <View>
            <Text style={styles.categoryHeaderTitle}>{cat.label}</Text>
            <Text style={styles.categoryHeaderSub}>{cat.articles.length} articles</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.hubContent}>
        <SecLabel text="Frequently Asked" />
        {cat.articles.map((a, i) => {
          const isOpen = openIdx === i;
          return (
            <View
              key={i}
              style={[styles.faqCard, isOpen && { borderColor: cat.color + '50', shadowColor: cat.color, elevation: 2 }]}
            >
              <TouchableOpacity style={styles.faqHeader} onPress={() => setOpenIdx(isOpen ? null : i)}>
                <View style={[styles.faqToggle, isOpen && { backgroundColor: cat.color + '25' }]}>
                  <Text style={[styles.faqToggleText, { color: isOpen ? cat.color : D.textMuted }]}>
                    {isOpen ? '−' : '+'}
                  </Text>
                </View>
                <Text style={[styles.faqQuestion, isOpen && { color: D.text }]}>{a.q}</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.faqBody}>
                  <Text style={styles.faqAnswer}>{a.a}</Text>
                  <View style={styles.faqActions}>
                    {feedbackGiven[i] ? (
                      <Text style={{ color: D.accent2, fontSize: 13 }}>✓ Thanks for your feedback!</Text>
                    ) : (
                      <>
                        <TouchableOpacity style={styles.faqHelpfulBtn} onPress={() => handleFeedback(i, true)}>
                          <Text style={styles.faqHelpfulText}>👍 Helpful</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.faqHelpfulBtn} onPress={() => handleFeedback(i, false)}>
                          <Text style={styles.faqHelpfulText}>👎 Not helpful</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity style={styles.faqNeedHelpBtn} onPress={onArticle}>
                      <Text style={styles.faqNeedHelpText}>Still need help →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NEW TICKET VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface NewTicketViewProps {
  onBack: () => void;
  onSubmitted: (id: string, subject: string) => void;
  defaultPriority?: Ticket['priority'];
  insets: { top: number; bottom: number };
}

const NewTicketView: React.FC<NewTicketViewProps> = ({ onBack, onSubmitted, defaultPriority, insets }) => {
  const [form, setForm] = useState({
    subject: '',
    category: '',
    priority: defaultPriority || 'medium',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.category) e.category = 'Please select a category';
    if (form.message.trim().length < 20) e.message = 'Please add more detail (min 20 characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    
    try {
      const response = await SupportAPI.createTicket({
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        message: form.message,
      });
      setBusy(false);
      onSubmitted(response.id, form.subject);
    } catch (error: any) {
      setBusy(false);
      // Show error or fallback to mock for demo
      console.warn('Failed to create ticket:', error);
      // Fallback to mock response for demo/offline
      const id = 'TK-' + String(100 + Math.floor(Math.random() * 899)).padStart(3, '0');
      onSubmitted(id, form.subject);
    }
  };

  const pColors: Record<string, string> = {
    low: D.textMuted,
    medium: D.accent,
    high: D.warn,
    critical: D.danger,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.hubContainer} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={D.gradientHeader} style={[styles.hubHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.hubHeaderCircle1} />
          <View style={styles.hubHeaderCircle2} />
          <BackBtn onBack={onBack} />
          <Text style={styles.hubTitle}>New Support Ticket</Text>
          <Text style={styles.hubSubtitle}>Describe your issue and we'll get back to you</Text>
        </LinearGradient>

        <View style={styles.hubContent}>
          {/* Subject */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>SUBJECT</Text>
            <TextInput
              style={[styles.formInput, errors.subject && styles.formInputError]}
              placeholder="Brief description of your issue"
              placeholderTextColor={D.textPlaceholder}
              value={form.subject}
              onChangeText={(v) => set('subject', v)}
            />
            {errors.subject && <Text style={styles.formError}>⚠ {errors.subject}</Text>}
          </View>

          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {CATEGORIES_FALLBACK.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.categoryPickerItem,
                    form.category === c.id && { borderColor: c.color, backgroundColor: c.color + '15' },
                  ]}
                  onPress={() => set('category', c.id)}
                >
                  <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                  <Text style={[styles.categoryPickerLabel, form.category === c.id && { color: D.text }]}>
                    {c.label.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.category && <Text style={styles.formError}>⚠ {errors.category}</Text>}
          </View>

          {/* Priority */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    form.priority === p && { backgroundColor: pColors[p] + '20', borderColor: pColors[p] + '60' },
                  ]}
                  onPress={() => set('priority', p)}
                >
                  <Text style={[styles.priorityBtnText, { color: form.priority === p ? pColors[p] : D.textMuted }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.priority === 'critical' && (
              <View style={styles.criticalWarning}>
                <Text style={{ fontSize: 16 }}>🚨</Text>
                <Text style={styles.criticalWarningText}>
                  Critical tickets are escalated immediately and reviewed within 6–12 hours by our compliance team.
                </Text>
              </View>
            )}
          </View>

          {/* Message */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>DESCRIBE YOUR ISSUE</Text>
            <TextInput
              style={[styles.formTextarea, errors.message && styles.formInputError]}
              placeholder="What happened? When did it occur? Any error messages?"
              placeholderTextColor={D.textPlaceholder}
              value={form.message}
              onChangeText={(v) => set('message', v)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={styles.formCharCount}>
              {errors.message ? (
                <Text style={styles.formError}>⚠ {errors.message}</Text>
              ) : (
                <View />
              )}
              <Text style={[styles.charCountText, { color: form.message.length > 20 ? D.accent2 : D.textMuted }]}>
                {form.message.length} chars
              </Text>
            </View>
          </View>

          {/* Attachment hint */}
          <View style={styles.attachmentHint}>
            <Text style={{ fontSize: 18 }}>📎</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentTitle}>Attach screenshots</Text>
              <Text style={styles.attachmentSub}>
                Screenshots help us resolve faster. Email them to support@groupsave.app after submission, quoting your
                ticket ID.
              </Text>
            </View>
          </View>

          <Btn onPress={submit} disabled={busy} style={{ marginTop: 8 }}>
            {busy ? '⟳ Submitting…' : '📩 Submit Ticket'}
          </Btn>
          <Text style={styles.termsText}>
            By submitting you agree to our <Text style={{ color: D.accent }}>Terms</Text> &{' '}
            <Text style={{ color: D.accent }}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MY TICKETS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface MyTicketsViewProps {
  onBack: () => void;
  onTicket: (t: Ticket) => void;
  tickets: Ticket[];
  insets: { top: number; bottom: number };
  loading?: boolean;
  onRefresh?: () => void;
}

const MyTicketsView: React.FC<MyTicketsViewProps> = ({ onBack, onTicket, tickets, insets, loading, onRefresh }) => {
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_review').length;

  return (
    <ScrollView style={styles.hubContainer} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0f2060', '#1a3570']} style={[styles.hubHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.hubHeaderCircle1} />
        <View style={styles.hubHeaderCircle2} />
        <BackBtn onBack={onBack} />
        <View style={styles.ticketsHeaderRow}>
          <View>
            <Text style={styles.hubTitle}>My Tickets</Text>
            <Text style={styles.hubSubtitle}>Track your support requests</Text>
          </View>
          {openCount > 0 && (
            <View style={styles.openBadge}>
              <Text style={styles.openBadgeText}>{openCount} open</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.hubContent}>
        {/* Stats */}
        <View style={styles.ticketStatsRow}>
          {[
            { l: 'Total', v: tickets.length, c: D.accent },
            { l: 'Open', v: tickets.filter((t) => ['open', 'in_review'].includes(t.status)).length, c: D.warn },
            { l: 'Resolved', v: tickets.filter((t) => t.status === 'resolved').length, c: D.accent2 },
          ].map((s) => (
            <View key={s.l} style={[styles.ticketStatCard, { borderColor: s.c + '25' }]}>
              <Text style={[styles.ticketStatValue, { color: s.c }]}>{s.v}</Text>
              <Text style={styles.ticketStatLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        <SecLabel text="All Requests" />
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={D.accent} />
            <Text style={{ color: D.textMuted, marginTop: 12, fontSize: 13 }}>Loading tickets...</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyTickets}>
            <Text style={{ fontSize: 38, marginBottom: 12 }}>🎉</Text>
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySubtitle}>You haven't submitted any support requests</Text>
          </View>
        ) : (
          <>
            {onRefresh && (
              <TouchableOpacity onPress={onRefresh} style={{ alignSelf: 'flex-end', marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="refresh" size={14} color={D.accent} />
                <Text style={{ color: D.accent, fontSize: 13 }}>Refresh</Text>
              </TouchableOpacity>
            )}
            {tickets.map((t) => {
            const s = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
            const p = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            const isActive = t.status === 'open' || t.status === 'in_review';

            return (
              <TouchableOpacity key={t.id} style={[styles.ticketCard, isActive && { borderColor: s.color + '40' }]} onPress={() => onTicket(t)}>
                {isActive && <View style={[styles.ticketActiveBar, { backgroundColor: s.color }]} />}
                <View style={styles.ticketCardHeader}>
                  <Text style={styles.ticketId}>{t.id}</Text>
                  <View style={styles.ticketBadges}>
                    <StatusBadge status={t.status} />
                    <View style={[styles.priorityBadge, { backgroundColor: p.color + '15' }]}>
                      <Text style={[styles.priorityBadgeText, { color: p.color }]}>{p.label}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <View style={styles.ticketDates}>
                  <Text style={styles.ticketDateText}>Opened {fmtDate(t.date)}</Text>
                  <Text style={styles.ticketDateText}>Updated {fmtDate(t.updated)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          </>
        )}
      </View>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  TICKET DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface TicketDetailViewProps {
  ticket: Ticket;
  onBack: () => void;
  showToast: (msg: string) => void;
  insets: { top: number; bottom: number };
}

const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticket, onBack, showToast, insets }) => {
  const [reply, setReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const s = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const p = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplyLoading(true);
    try {
      await SupportAPI.replyToTicket(ticket.id, reply);
      showToast('Reply sent to support team');
      setReply('');
    } catch (error) {
      console.warn('Failed to send reply:', error);
      showToast('Failed to send reply. Please try again.');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleEscalate = async () => {
    setEscalateLoading(true);
    try {
      await SupportAPI.escalateTicket(ticket.id);
      showToast('Ticket escalated to senior support');
    } catch (error) {
      console.warn('Failed to escalate:', error);
      showToast('Failed to escalate. Please try again.');
    } finally {
      setEscalateLoading(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    try {
      await SupportAPI.submitTicketFeedback(ticket.id, helpful);
      setFeedbackGiven(true);
      showToast(helpful ? 'Thanks for your feedback!' : "We'll look into it further");
    } catch (error) {
      console.warn('Failed to submit feedback:', error);
      // Still mark as given for UX
      setFeedbackGiven(true);
      showToast(helpful ? 'Thanks for your feedback!' : "We'll look into it further");
    }
  };

  const slaMap: Record<string, string> = {
    low: '72hr SLA',
    medium: '48hr SLA',
    high: '24hr SLA',
    critical: '6–12hr SLA',
  };

  const timeline = [
    { label: 'Ticket submitted', time: ticket.date, icon: '📩', done: true },
    { label: 'Under review by support', time: ticket.updated, icon: '🔍', done: ticket.status !== 'open' },
    { label: 'Response sent to you', time: null, icon: '💬', done: ['escalated', 'resolved', 'closed'].includes(ticket.status) },
    { label: 'Resolved & closed', time: null, icon: '✅', done: ticket.status === 'resolved' || ticket.status === 'closed' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.hubContainer} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[s.color + '28', D.bg]} style={[styles.detailHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.hubHeaderCircle1} />
          <BackBtn onBack={onBack} light={false} />
          <View style={styles.detailHeaderTop}>
            <Text style={styles.ticketId}>{ticket.id}</Text>
            <View style={styles.ticketBadges}>
              <StatusBadge status={ticket.status} />
              <View style={[styles.priorityBadge, { backgroundColor: p.color + '15' }]}>
                <Text style={[styles.priorityBadgeText, { color: p.color }]}>{p.label} Priority</Text>
              </View>
            </View>
          </View>
          <Text style={styles.detailSubject}>{ticket.subject}</Text>
          <Text style={styles.detailDates}>Opened {fmtDate(ticket.date)} · Updated {fmtDate(ticket.updated)}</Text>
        </LinearGradient>

        <View style={styles.hubContent}>
          {/* SLA Banner */}
          <View
            style={[
              styles.slaBanner,
              {
                backgroundColor: ticket.priority === 'critical' ? D.dangerSoft : ticket.priority === 'high' ? D.warnSoft : D.accentSoft,
                borderColor: ticket.priority === 'critical' ? D.danger + '28' : ticket.priority === 'high' ? D.warn + '28' : D.accent + '28',
              },
            ]}
          >
            <Text style={{ fontSize: 18 }}>
              {ticket.priority === 'critical' ? '🚨' : ticket.priority === 'high' ? '⚡' : '⏱️'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.slaBannerTitle,
                  { color: ticket.priority === 'critical' ? D.danger : ticket.priority === 'high' ? D.warn : D.accent },
                ]}
              >
                {slaMap[ticket.priority] || 'Standard SLA'}
              </Text>
              <Text style={styles.slaBannerSub}>Our team will respond within the stated timeframe</Text>
            </View>
          </View>

          {/* Timeline */}
          <SecLabel text="Progress" />
          <Card>
            {timeline.map((t, i) => (
              <View key={i} style={[styles.timelineRow, i < timeline.length - 1 && styles.timelineRowBorder]}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineIcon,
                      t.done && { backgroundColor: s.color + '22', borderColor: s.color, shadowColor: s.color },
                    ]}
                  >
                    {t.done ? <Text style={{ fontSize: 13 }}>{t.icon}</Text> : <Text style={styles.timelineIconPending}>○</Text>}
                  </View>
                  {i < timeline.length - 1 && <View style={[styles.timelineLine, { backgroundColor: t.done ? s.color : D.border }]} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, !t.done && { color: D.textMuted }]}>{t.label}</Text>
                  <Text style={styles.timelineTime}>{t.time ? fmtDate(t.time) : t.done ? 'Completed' : 'Pending'}</Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Reply box */}
          {!['resolved', 'closed'].includes(ticket.status) && (
            <>
              <SecLabel text="Add a Reply" />
              <TextInput
                style={styles.replyInput}
                placeholder="Add more details or respond to our team..."
                placeholderTextColor={D.textPlaceholder}
                value={reply}
                onChangeText={setReply}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!replyLoading}
              />
              <Btn
                onPress={handleReply}
                style={{ marginBottom: 10 }}
                disabled={replyLoading || !reply.trim()}
              >
                {replyLoading ? 'Sending...' : 'Send Reply'}
              </Btn>
              <TouchableOpacity
                style={[styles.escalateBtn, escalateLoading && { opacity: 0.6 }]}
                onPress={handleEscalate}
                disabled={escalateLoading}
              >
                <Text style={styles.escalateBtnText}>
                  {escalateLoading ? '🚨 Escalating...' : '🚨 Escalate this ticket'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Resolved state */}
          {ticket.status === 'resolved' && (
            <View style={styles.resolvedCard}>
              <Text style={{ fontSize: 30, marginBottom: 8 }}>✅</Text>
              <Text style={styles.resolvedTitle}>Ticket Resolved</Text>
              <Text style={styles.resolvedSub}>Was this resolution helpful?</Text>
              {feedbackGiven ? (
                <Text style={{ color: D.accent2, fontSize: 14, marginTop: 12 }}>✓ Thanks for your feedback!</Text>
              ) : (
                <View style={styles.resolvedActions}>
                  <TouchableOpacity style={styles.resolvedBtnYes} onPress={() => handleFeedback(true)}>
                    <Text style={styles.resolvedBtnYesText}>👍 Yes, thanks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resolvedBtnNo} onPress={() => handleFeedback(false)}>
                    <Text style={styles.resolvedBtnNoText}>👎 Needs work</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  TICKET SUCCESS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface TicketSuccessViewProps {
  ticketId: string;
  onBack: () => void;
  onViewTickets: () => void;
  insets: { top: number; bottom: number };
}

const TicketSuccessView: React.FC<TicketSuccessViewProps> = ({ ticketId, onBack, onViewTickets, insets }) => {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.successContainer, { paddingTop: insets.top + 40, transform: [{ scale }], opacity }]}>
      <LinearGradient colors={D.gradientSuccess} style={styles.successIcon}>
        <Text style={{ fontSize: 36 }}>📩</Text>
      </LinearGradient>
      <Text style={styles.successTitle}>Ticket Submitted!</Text>
      <Text style={styles.successSub}>Your request has been received. We'll get back to you shortly.</Text>
      <Text style={styles.successTicketId}>{ticketId}</Text>

      <Card style={{ width: '100%', marginBottom: 22 }}>
        {[
          { i: '⏱️', t: "We'll respond within your plan's SLA window" },
          { i: '📧', t: 'Confirmation sent to your registered email' },
          { i: '🔍', t: 'Track progress in My Tickets' },
          { i: '🚨', t: 'Need urgent help? Re-submit with Critical priority' },
        ].map((s, i, arr) => (
          <View key={i} style={[styles.successInfoRow, i < arr.length - 1 && styles.successInfoRowBorder]}>
            <Text style={{ fontSize: 16 }}>{s.i}</Text>
            <Text style={styles.successInfoText}>{s.t}</Text>
          </View>
        ))}
      </Card>

      <Btn onPress={onViewTickets} style={{ width: '100%', marginBottom: 10 }}>
        View My Tickets
      </Btn>
      <Btn variant="ghost" onPress={onBack} style={{ width: '100%' }}>
        Back to Support
      </Btn>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SUPPORT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

const SupportScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<ScreenType>('hub');
  const [ctx, setCtx] = useState<any>({});
  const [toast, setToast] = useState<string | null>(null);
  const [newId, setNewId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const ticketsFetched = useRef(false);

  // Fetch tickets when navigating to my-tickets
  useEffect(() => {
    if (screen === 'my-tickets' && !ticketsFetched.current) {
      fetchTickets();
    }
  }, [screen]);

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const data = await SupportAPI.getTickets();
      setTickets(data);
      ticketsFetched.current = true;
    } catch (error) {
      console.warn('Failed to fetch tickets:', error);
      // Keep existing tickets on error
    } finally {
      setTicketsLoading(false);
    }
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const nav = useCallback((s: ScreenType, c: any = {}) => {
    setCtx(c);
    setScreen(s);
  }, []);

  const onSubmitted = useCallback((id: string, subject: string) => {
    setNewId(id);
    setTickets((prev) => [
      {
        id,
        subject,
        status: 'open',
        priority: ctx.priority || 'medium',
        date: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
      },
      ...prev,
    ]);
    setScreen('ticket-success');
  }, [ctx.priority]);

  const handleGoBack = useCallback(() => {
    if (screen === 'hub') {
      navigation.goBack();
    } else {
      setScreen('hub');
    }
  }, [screen, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Hub is always rendered underneath */}
      <HubView nav={nav} insets={insets} />

      <SlideIn visible={screen === 'category'}>
        {ctx.cat && (
          <CategoryView
            cat={ctx.cat}
            onBack={() => nav('hub')}
            onArticle={() => nav('new-ticket')}
            expandArticle={ctx.expandArticle}
            insets={insets}
          />
        )}
      </SlideIn>

      <SlideIn visible={screen === 'new-ticket'}>
        <NewTicketView
          onBack={() => nav(ctx.fromTickets ? 'my-tickets' : 'hub')}
          onSubmitted={onSubmitted}
          defaultPriority={ctx.priority}
          insets={insets}
        />
      </SlideIn>

      <SlideIn visible={screen === 'my-tickets'}>
        <MyTicketsView
          onBack={() => nav('hub')}
          onTicket={(t) => nav('ticket-detail', { ticket: t })}
          tickets={tickets}
          insets={insets}
          loading={ticketsLoading}
          onRefresh={fetchTickets}
        />
      </SlideIn>

      <SlideIn visible={screen === 'ticket-detail'}>
        {ctx.ticket && (
          <TicketDetailView
            ticket={ctx.ticket}
            onBack={() => nav('my-tickets')}
            showToast={showToast}
            insets={insets}
          />
        )}
      </SlideIn>

      <SlideIn visible={screen === 'ticket-success'}>
        <TicketSuccessView
          ticketId={newId}
          onBack={() => nav('hub')}
          onViewTickets={() => nav('my-tickets')}
          insets={insets}
        />
      </SlideIn>

      <ToastMessage msg={toast} />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: D.bg,
  },
  slideIn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: D.bg,
    zIndex: 20,
  },

  // Hub
  hubContainer: {
    flex: 1,
    backgroundColor: D.bg,
  },
  hubHeader: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  hubHeaderCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hubHeaderCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  hubHeaderIcon: {
    position: 'absolute',
    bottom: -10,
    right: 16,
    fontSize: 80,
    opacity: 0.07,
  },
  hubTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  hubSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  hubContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchWrapFocused: {
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: D.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: '#fff',
    fontSize: 14,
  },
  searchResults: {
    marginTop: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
  },
  searchResultIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultQ: {
    fontSize: 13,
    fontWeight: '700',
    color: D.text,
  },
  searchResultCat: {
    fontSize: 11,
    color: D.textMuted,
    marginTop: 2,
  },

  // Section Label
  secLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  secLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: D.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  secLabelAction: {
    fontSize: 11,
    color: D.accent,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: D.text,
    marginBottom: 2,
  },
  quickActionSub: {
    fontSize: 10,
    color: D.textMuted,
    textAlign: 'center',
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  contactRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: D.text,
    marginBottom: 2,
  },
  contactSub: {
    fontSize: 11,
    color: D.textMuted,
  },
  noteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 2,
  },
  noteBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // SLA
  slaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  slaRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  slaTier: {
    fontSize: 13,
    color: D.textSub,
  },
  slaSla: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Categories
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: D.text,
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: 11,
    color: D.textMuted,
  },
  articleCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  articleCountText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Legal
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  legalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  legalLabel: {
    flex: 1,
    fontSize: 13,
    color: D.textSub,
    fontWeight: '500',
  },

  footerText: {
    fontSize: 11,
    color: D.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },

  // Empty state
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: D.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: D.textMuted,
  },
  miniBtn: {
    backgroundColor: D.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  miniBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Back Button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backBtnLight: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backBtnDark: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1,
    borderColor: D.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Button
  btn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  btnGhost: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: D.textSub,
  },

  // Category View
  categoryHeader: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    position: 'relative',
    overflow: 'hidden',
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 3,
  },
  categoryHeaderSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },

  // FAQ
  faqCard: {
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
  },
  faqToggle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: D.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqToggleText: {
    fontSize: 14,
    fontWeight: '800',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: D.textSub,
    lineHeight: 18,
  },
  faqBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 53,
  },
  faqAnswer: {
    fontSize: 13,
    color: D.textSub,
    lineHeight: 22,
    marginBottom: 14,
  },
  faqActions: {
    flexDirection: 'row',
    gap: 8,
  },
  faqHelpfulBtn: {
    backgroundColor: D.accent2Soft,
    borderWidth: 1,
    borderColor: D.accent2 + '25',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  faqHelpfulText: {
    fontSize: 11,
    fontWeight: '700',
    color: D.accent2,
  },
  faqNeedHelpBtn: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  faqNeedHelpText: {
    fontSize: 11,
    fontWeight: '600',
    color: D.textMuted,
  },

  // New Ticket Form
  formGroup: {
    marginBottom: 18,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: D.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1.5,
    borderColor: D.border,
    borderRadius: 12,
    padding: 12,
    color: D.text,
    fontSize: 14,
  },
  formInputError: {
    borderColor: D.danger,
  },
  formTextarea: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1.5,
    borderColor: D.border,
    borderRadius: 12,
    padding: 12,
    color: D.text,
    fontSize: 14,
    minHeight: 120,
  },
  formError: {
    fontSize: 11,
    color: D.danger,
    marginTop: 5,
  },
  formCharCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCountText: {
    fontSize: 11,
  },
  categoryPicker: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  categoryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: D.surfaceHi,
    borderWidth: 1.5,
    borderColor: D.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  categoryPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: D.textMuted,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: D.surfaceHi,
    borderWidth: 1.5,
    borderColor: D.border,
    alignItems: 'center',
  },
  priorityBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  criticalWarning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 10,
    backgroundColor: D.dangerSoft,
    borderWidth: 1,
    borderColor: D.danger + '30',
    borderRadius: 10,
    padding: 10,
  },
  criticalWarningText: {
    flex: 1,
    fontSize: 11,
    color: D.danger,
    lineHeight: 16,
  },
  attachmentHint: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: D.accentSoft,
    borderWidth: 1,
    borderColor: D.accent + '20',
    borderRadius: 12,
    padding: 12,
    marginBottom: 22,
  },
  attachmentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: D.accent,
    marginBottom: 2,
  },
  attachmentSub: {
    fontSize: 11,
    color: D.textMuted,
    lineHeight: 16,
  },
  termsText: {
    fontSize: 11,
    color: D.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },

  // My Tickets
  ticketsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  openBadge: {
    backgroundColor: 'rgba(255,95,95,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,95,95,0.3)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffaaaa',
  },
  ticketStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  ticketStatCard: {
    flex: 1,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ticketStatValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  ticketStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: D.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyTickets: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  ticketCard: {
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  ticketActiveBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 11,
    fontWeight: '700',
    color: D.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ticketBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ticketSubject: {
    fontSize: 13,
    fontWeight: '700',
    color: D.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  ticketDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketDateText: {
    fontSize: 11,
    color: D.textMuted,
  },

  // Ticket Detail
  detailHeader: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    position: 'relative',
    overflow: 'hidden',
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  detailSubject: {
    fontSize: 18,
    fontWeight: '800',
    color: D.text,
    lineHeight: 24,
    marginBottom: 5,
  },
  detailDates: {
    fontSize: 11,
    color: D.textMuted,
  },
  slaBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  slaBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  slaBannerSub: {
    fontSize: 11,
    color: D.textMuted,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingBottom: 14,
    marginBottom: 14,
  },
  timelineRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  timelineIconCol: {
    alignItems: 'center',
    gap: 3,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: D.surfaceHi,
    borderWidth: 2,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconPending: {
    fontSize: 10,
    color: D.textMuted,
  },
  timelineLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  timelineContent: {
    paddingTop: 4,
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: D.text,
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 11,
    color: D.textMuted,
  },
  replyInput: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1.5,
    borderColor: D.border,
    borderRadius: 12,
    padding: 12,
    color: D.text,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 10,
  },
  escalateBtn: {
    borderWidth: 1,
    borderColor: D.danger + '35',
    borderRadius: 13,
    padding: 12,
    alignItems: 'center',
  },
  escalateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: D.danger,
  },
  resolvedCard: {
    backgroundColor: D.accent2Soft,
    borderWidth: 1,
    borderColor: D.accent2 + '30',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  resolvedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: D.accent2,
    marginBottom: 4,
  },
  resolvedSub: {
    fontSize: 12,
    color: D.textMuted,
    marginBottom: 16,
  },
  resolvedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resolvedBtnYes: {
    backgroundColor: D.accent2Soft,
    borderWidth: 1,
    borderColor: D.accent2 + '30',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  resolvedBtnYesText: {
    fontSize: 12,
    fontWeight: '700',
    color: D.accent2,
  },
  resolvedBtnNo: {
    backgroundColor: D.surfaceHi,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  resolvedBtnNoText: {
    fontSize: 12,
    fontWeight: '700',
    color: D.textSub,
  },

  // Success
  successContainer: {
    flex: 1,
    backgroundColor: D.bg,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: D.accent2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: D.text,
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    color: D.textSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  successTicketId: {
    fontSize: 14,
    fontWeight: '700',
    color: D.accent,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginBottom: 28,
  },
  successInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
  },
  successInfoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  successInfoText: {
    flex: 1,
    fontSize: 13,
    color: D.textSub,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: D.surfaceHi,
    borderWidth: 1,
    borderColor: D.borderHi,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: D.text,
  },
});

export default SupportScreen;
