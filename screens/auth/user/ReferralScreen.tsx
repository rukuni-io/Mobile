import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Share,
    Platform,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const D = {
    bg:          '#0e0f17',
    surface:     '#161821',
    surfaceHi:   '#1e2030',
    border:      '#2a2d3e',
    text:        '#e8eaf6',
    textSub:     '#8b8fa8',
    textMuted:   '#555870',
    accent:      '#7c8cff',
    accentSoft:  'rgba(124,140,255,0.12)',
    accent2:     '#38d9a9',
    accent2Soft: 'rgba(56,217,169,0.12)',
    warn:        '#ffa94d',
    warnSoft:    'rgba(255,169,77,0.12)',
    danger:      '#ff6b6b',
    dangerSoft:  'rgba(255,107,107,0.12)',
    purple:      '#c084fc',
    purpleSoft:  'rgba(192,132,252,0.12)',
    toggleBg:    '#2a2d3e',
};




// ─── Types ────────────────────────────────────────────────────────────────────
type RootStackParamList = { Dashboard: undefined };

interface Referral {
    name:    string;
    date:    string;
    status:  'active' | 'pending';
    reward:  number;
}

interface UserData {
    name?:              string;
    referral_code?:     string;
    referral_earnings?: number;
    referrals_count?:   number;
    referrals?:         Referral[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPoints = (n: number) =>
    `${n.toLocaleString()} ${n === 1 ? 'pt' : 'pts'}`;

const fmtShort = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const initials = (n?: string) =>
    (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ─── Sub-Components ───────────────────────────────────────────────────────────
const SecLabel: React.FC<{ text: string }> = ({ text }) => {
    return <Text style={styles.sectionLabel}>{text}</Text>;
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
const ReferralScreen: React.FC = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const apiUrl = Constants.expoConfig?.extra?.apiUrl || '';

    const [user, setUser]       = useState<UserData>({});
    const [refs, setRefs]       = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied]   = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    // Fetch referral dashboard data
    const fetchDashboard = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get<any>(`${apiUrl}/user/referral`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            // Handle different possible response structures
            const data = response.data?.data || response.data;
            setUser({
                referral_code: data.referral_code || data.referralCode || data.code,
                referral_earnings: data.referral_earnings || data.referralEarnings || data.earnings || 0,
                referrals_count: data.referrals_count || data.referralsCount || data.count || 0,
            });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed to load referral data' });
        }
    }, [apiUrl]);

    // Fetch referral history
    const fetchHistory = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get<{ referrals?: Referral[] }>(`${apiUrl}/user/referral/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRefs(response.data.referrals || []);
        } catch (error) {
            setRefs([]);
        }
    }, [apiUrl]);

    useEffect(() => {
        (async () => {
            try {
                await Promise.all([fetchDashboard(), fetchHistory()]);
            } finally {
                setLoading(false);
            }
        })();
    }, [fetchDashboard, fetchHistory]);

    // Regenerate referral code
    const handleRegenerate = useCallback(async () => {
        setRegenerating(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.post<{ referral_code?: string; code?: string; data?: { referral_code?: string } }>(
                `${apiUrl}/user/referral/regenerate-code`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Handle different possible response structures
            const newCode = response.data.referral_code 
                || response.data.code 
                || response.data.data?.referral_code;
            
            if (newCode) {
                setUser(prev => ({ ...prev, referral_code: newCode }));
                Toast.show({ type: 'success', text1: 'Referral code regenerated!' });
            } else {
                Toast.show({ type: 'error', text1: 'Unexpected response format' });
            }
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: error.response?.data?.message || 'Failed to regenerate code',
            });
        } finally {
            setRegenerating(false);
        }
    }, [apiUrl]);

    const referralCode = user.referral_code ?? 'GRP-XXXX';
    const earnings     = user.referral_earnings ?? 0;
    const referrals    = refs; // Use actual data, no fallback to sample
    const active       = referrals.filter(r => r.status === 'active').length;
    const pending      = referrals.filter(r => r.status === 'pending').length;
    const milestone    = 50;
    const progress     = Math.min((earnings / milestone) * 100, 100);

    const handleCopy = useCallback(() => {
        setCopied(true);
        Toast.show({ type: 'success', text1: `Code "${referralCode}" copied!` });
        setTimeout(() => setCopied(false), 2000);
    }, [referralCode]);

    const handleShare = useCallback(async (method: string) => {
        if (method === 'Share') {
            try {
                await Share.share({
                    message: `Join GroupSave and save together! Use my referral code: ${referralCode}`,
                });
            } catch {}
            return;
        }
        Toast.show({ type: 'info', text1: `Sharing via ${method}…` });
    }, [referralCode]);

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={D.accent2} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <LinearGradient
                    colors={['#0d2818', '#1a4d2e', '#25a071']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <SafeAreaView>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={16} color="#fff" />
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                        <View style={styles.headerContent}>
                            <Text style={styles.headerIcon}>🎁</Text>
                            <Text style={styles.headerTitle}>Referral Programme</Text>
                            <Text style={styles.headerSub}>
                                Earn{' '}
                                <Text style={{ color: '#fff', fontWeight: '800' }}>10 points</Text>
                                {' '}for every friend who joins GroupSave
                            </Text>
                            {/* Mini stats */}
                            <View style={styles.headerStats}>
                                {[
                                    { label: 'ACTIVE',  value: String(active) },
                                    { label: 'PENDING', value: String(pending) },
                                    { label: 'EARNED',  value: fmtPoints(earnings) },
                                ].map(s => (
                                    <View key={s.label} style={styles.miniStat}>
                                        <Text style={styles.miniStatValue}>{s.value}</Text>
                                        <Text style={styles.miniStatLabel}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {/* ── Referral Code ── */}
                    <SecLabel text="Your Referral Code" />
                    <View style={[styles.card, styles.codeCard]}>
                        <Text style={styles.codeHint}>
                            Share this code — friends enter it on sign up
                        </Text>
                        <View style={styles.codeRow}>
                            <View style={styles.codeBox}>
                                <Text style={styles.codeText}>{referralCode}</Text>
                            </View>
                            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                                <LinearGradient
                                    colors={copied ? ['#38d9a9', '#20b087'] : ['#38d9a9', '#20b087']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.copyBtnGrad}
                                >
                                    <Ionicons
                                        name={copied ? 'checkmark' : 'copy-outline'}
                                        size={16}
                                        color="#fff"
                                    />
                                    <Text style={styles.copyBtnText}>
                                        {copied ? 'Copied!' : 'Copy'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.regenerateBtn}
                            onPress={handleRegenerate}
                            disabled={regenerating}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="refresh-outline"
                                size={14}
                                color={regenerating ? D.textMuted : D.accent}
                            />
                            <Text style={[styles.regenerateBtnText, regenerating && { color: D.textMuted }]}>
                                {regenerating ? 'Regenerating...' : 'Regenerate Code'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── Earnings Overview ── */}
                    <SecLabel text="Earnings Overview" />
                    <View style={styles.card}>
                        <View style={styles.earningsRow}>
                            <View>
                                <Text style={styles.earningsSubLabel}>Total Earned</Text>
                                <Text style={[styles.earningsBig, { color: D.accent2 }]}>
                                    {fmtPoints(earnings)}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.earningsSubLabel}>Per Referral</Text>
                                <Text style={[styles.earningsBig, { color: D.accent }]}>10 pts</Text>
                            </View>
                        </View>
                        <Text style={styles.milestoneLabel}>Progress to {fmtPoints(milestone)} milestone</Text>
                        <View style={styles.progressTrack}>
                            <LinearGradient
                                colors={['#38d9a9', '#20b087']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.progressFill, { width: `${progress}%` as any }]}
                            />
                        </View>
                        <View style={styles.progressLabels}>
                            <Text style={styles.progressText}>{fmtPoints(earnings)} earned</Text>
                            <Text style={styles.progressText}>{fmtPoints(milestone - earnings)} to go</Text>
                        </View>
                    </View>

                    {/* ── Share Via ── */}
                    <SecLabel text="Share Via" />
                    <View style={styles.shareRow}>
                        {[
                            { icon: '💬', label: 'WhatsApp', color: '#25d366' },
                            { icon: '📧', label: 'Email',    color: D.accent },
                            { icon: '📱', label: 'SMS',      color: D.warn },
                            { icon: '🔗', label: 'Share',    color: D.purple },
                        ].map(s => (
                            <TouchableOpacity
                                key={s.label}
                                style={[styles.shareBtn, { borderColor: `${s.color}30` }]}
                                onPress={() => handleShare(s.label)}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.shareBtnIcon}>{s.icon}</Text>
                                <Text style={[styles.shareBtnLabel, { color: s.color }]}>
                                    {s.label.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── Referral History ── */}
                    <SecLabel text="Referral History" />
                    <View style={styles.card}>
                        {referrals.length === 0 ? (
                            <Text style={styles.emptyText}>No referrals yet. Share your code to get started!</Text>
                        ) : referrals.map((r, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.refRow,
                                    i < referrals.length - 1 && styles.refRowBorder,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.refAvatar,
                                        {
                                            backgroundColor: r.status === 'active'
                                                ? D.accent2Soft : D.warnSoft,
                                            borderColor: r.status === 'active'
                                                ? `${D.accent2}30` : `${D.warn}30`,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.refAvatarText,
                                            { color: r.status === 'active' ? D.accent2 : D.warn },
                                        ]}
                                    >
                                        {initials(r.name)}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.refName}>{r.name}</Text>
                                    <Text style={styles.refDate}>{fmtShort(r.date)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text
                                        style={[
                                            styles.refReward,
                                            { color: r.status === 'active' ? D.accent2 : D.textMuted },
                                        ]}
                                    >
                                        {r.status === 'active' ? `+${fmtPoints(r.reward)}` : 'Pending'}
                                    </Text>
                                    <View
                                        style={[
                                            styles.refStatusPill,
                                            {
                                                backgroundColor: r.status === 'active'
                                                    ? D.accent2Soft : D.warnSoft,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.refStatusText,
                                                { color: r.status === 'active' ? D.accent2 : D.warn },
                                            ]}
                                        >
                                            {r.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* ── How It Works ── */}
                    <SecLabel text="How It Works" />
                    <View style={styles.card}>
                        {[
                            { n: 1, icon: '🔗', text: 'Share your unique code with friends' },
                            { n: 2, icon: '📝', text: 'They sign up on GroupSave using your code' },
                            { n: 3, icon: '✅', text: 'They create or join their first savings group' },
                            { n: 4, icon: '💰', text: '10 points are credited to your account automatically' },
                        ].map((s, idx, arr) => (
                            <View
                                key={s.n}
                                style={[styles.howRow, idx < arr.length - 1 && styles.howRowBorder]}
                            >
                                <LinearGradient
                                    colors={['#7c8cff', '#9b59d4']}
                                    style={styles.howBadge}
                                >
                                    <Text style={styles.howBadgeIcon}>{s.icon}</Text>
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.howStep}>Step {s.n}</Text>
                                    <Text style={styles.howText}>{s.text}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root:        { flex: 1, backgroundColor: D.bg },
    scroll:      { flex: 1 },
    loadingWrap: { flex: 1, backgroundColor: D.bg, alignItems: 'center', justifyContent: 'center' },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
    },
    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20, marginBottom: 16,
    },
    backBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
    headerContent:   { alignItems: 'center' },
    headerIcon:      { fontSize: 46, marginBottom: 10 },
    headerTitle:     { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
    headerSub:       { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 18, textAlign: 'center' },
    headerStats:     { flexDirection: 'row', gap: 10 },
    miniStat: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    miniStatValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
    miniStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 0.6 },

    // Body
    body: { paddingHorizontal: 16, paddingTop: 16 },

    sectionLabel: {
        fontSize: 10, fontWeight: '700', color: D.textMuted,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginTop: 16, marginBottom: 10,
    },
    card: {
        backgroundColor: D.surface,
        borderRadius: 18, borderWidth: 1, borderColor: D.border,
        paddingHorizontal: 18, paddingVertical: 10,
        marginBottom: 4,
    },
    codeCard: {
        backgroundColor: '#0d1f14',
        borderColor: 'rgba(56,217,169,0.2)',
    },
    codeHint:  { fontSize: 12, color: D.textMuted, marginBottom: 12 },
    codeRow:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
    codeBox: {
        flex: 1, backgroundColor: D.surfaceHi,
        borderWidth: 2, borderColor: 'rgba(56,217,169,0.35)',
        borderStyle: 'dashed', borderRadius: 12,
        paddingVertical: 14, alignItems: 'center',
    },
    codeText: {
        fontSize: 22, fontWeight: '800', color: D.accent2,
        letterSpacing: 5, fontVariant: ['tabular-nums'],
    },
    copyBtn:     { borderRadius: 12, overflow: 'hidden' },
    copyBtnGrad: {
        paddingHorizontal: 18, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    regenerateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
    },
    regenerateBtnText: {
        color: D.accent,
        fontSize: 13,
        fontWeight: '600',
    },
    emptyText: {
        color: D.textMuted,
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 20,
    },

    // Earnings
    earningsRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginBottom: 14, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: D.border,
    },
    earningsSubLabel: { fontSize: 12, color: D.textMuted, marginBottom: 3 },
    earningsBig:      { fontSize: 28, fontWeight: '800' },
    milestoneLabel:   { fontSize: 12, color: D.textMuted, marginBottom: 8 },
    progressTrack: {
        height: 8, backgroundColor: D.border,
        borderRadius: 4, overflow: 'hidden', marginBottom: 5,
    },
    progressFill:   { height: '100%', borderRadius: 4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText:   { fontSize: 11, color: D.textMuted },

    // Share
    shareRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    shareBtn: {
        flex: 1, backgroundColor: D.surface,
        borderWidth: 1, borderRadius: 14,
        paddingVertical: 12, alignItems: 'center', gap: 5,
    },
    shareBtnIcon:  { fontSize: 20 },
    shareBtnLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

    // Referral history
    refRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 11, paddingVertical: 12,
    },
    refRowBorder: { borderBottomWidth: 1, borderBottomColor: D.border },
    refAvatar: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5,
    },
    refAvatarText: { fontSize: 13, fontWeight: '800' },
    refName:       { fontSize: 13, fontWeight: '700', color: D.text, marginBottom: 2 },
    refDate:       { fontSize: 11, color: D.textMuted },
    refReward:     { fontSize: 13, fontWeight: '700' },
    refStatusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 1 },
    refStatusText: { fontSize: 10, fontWeight: '700' },

    // How it works
    howRow: {
        flexDirection: 'row', gap: 12,
        alignItems: 'flex-start', paddingVertical: 12,
    },
    howRowBorder: { borderBottomWidth: 1, borderBottomColor: D.border },
    howBadge: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    howBadgeIcon: { fontSize: 14 },
    howStep:      { fontSize: 12, fontWeight: '700', color: D.accent, marginBottom: 2 },
    howText:      { fontSize: 13, color: D.textSub, lineHeight: 20 },
});

export default ReferralScreen;
