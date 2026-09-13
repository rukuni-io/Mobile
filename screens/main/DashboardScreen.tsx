import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    StatusBar,
    RefreshControl,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient as LG } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActionSheetRef } from "react-native-actions-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import axios from "axios";
import Constants from "expo-constants";

import MenuActionSheet from "../../components/MenuActionSheet";
import { semanticColors } from "../../theme/semanticColors";

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
    Home: undefined;
    Signin: undefined;
    Signup: undefined;
    Dashboard: undefined;
    CreateGroup: undefined;
    GroupDetails: { group_id: string; initial_role?: string; initial_is_active?: boolean };
    PlanPicker: undefined;
};

interface Group {
    id: string;
    title: string;
    target_amount: string;
    active_members: number;
    total_members: number;
    owner?: string;
    is_active?: boolean;
    user_role?: "admin" | "member";
    payable_amount?: string;
}

interface DashboardStats {
    total_groups?: number;
    owned_groups?: number;
    member_groups?: number;
    active_groups?: number;
    pending_invitations?: number;
    unread_notifications?: number;
}

interface User {
    name?: string;
    email?: string;
    plan?: string;
}

interface GroupContribution {
    id: string;
    group_id: string;
    cycle_number: number;
    amount: string;
    status: 'pending' | 'verified' | 'rejected';
    submitted_at: string;
    due_date: string;
    note?: string | null;
    user?: { name?: string; email?: string; points?: number };
    group?: { title: string; target_amount?: string };
}

interface DashboardResponse {
    user_groups?: Group[];
    stats?: DashboardStats;
    user?: User;
    plan?: string;
    group_contributions?: GroupContribution[];
}

interface StatCardConfig {
    label: string;
    value: number;
    accentColor: string;
    icon: string;
    sparkData: number[];
    trendUp: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LinearGradient = LG as React.ComponentType<any>;

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
});

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
};

// ─── Utility Functions ────────────────────────────────────────────────────────

const formatCurrency = (amount: string | number): string => {
    return CURRENCY_FORMATTER.format(parseFloat(String(amount)));
};

const getGreeting = (name?: string): string => {
    if (!name) return "Hi 👋";
    const firstName = name.split(" ")[0];
    return `Hi ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}, 👋`;
};

const calculateProgress = (active: number, total: number): number => {
    if (total === 0) return 0;
    return (active / total) * 100;
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const LoadingView: React.FC = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={semanticColors.buttonPrimary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
    </View>
);

const Header: React.FC<{
    userName?: string;
    onMenuPress: () => void;
}> = ({ userName, onMenuPress }) => (
    <View style={styles.header}>
        <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
                <Text style={styles.title}>{getGreeting(userName)}</Text>
                <Text style={styles.subtitle}>
                    {new Date().toLocaleDateString("en-GB", DATE_OPTIONS)}
                </Text>
            </View>
            <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
                <View style={styles.hamburgerButton}>
                    <View style={styles.hamburgerLine} />
                    <View style={styles.hamburgerLine} />
                    <View style={styles.hamburgerLine} />
                </View>
            </TouchableOpacity>
        </View>
    </View>
);

const StatCard: React.FC<StatCardConfig> = ({ label, value, accentColor, icon, sparkData, trendUp }) => (
    <View style={styles.statCard}>
        {/* Gradient background */}
        <LinearGradient
            colors={['#1e1e1e', accentColor + '1e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
        />
        {/* Ghost background icon */}
        <View style={styles.statGhostIcon} pointerEvents="none">
            <Ionicons name={icon as any} size={78} color={accentColor} />
        </View>
        <View style={styles.statCardInner}>
            {/* Icon pill */}
            <View style={[styles.statIconWrap, { backgroundColor: accentColor + '28' }]}>
                <Ionicons name={icon as any} size={14} color={accentColor} />
            </View>

            {/* Value + trend pill */}
            <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{value}</Text>
                <View style={[styles.statTrendPill, {
                    backgroundColor: trendUp
                        ? 'rgba(0,214,143,0.18)'
                        : 'rgba(239,68,68,0.18)',
                }]}>
                    <Ionicons
                        name={trendUp ? 'trending-up' : 'trending-down'}
                        size={11}
                        color={trendUp ? '#00d68f' : '#ef4444'}
                    />
                </View>
            </View>

            {/* Label */}
            <Text style={styles.statLabel}>{label}</Text>

            {/* Sparkline */}
            <View style={styles.sparkline}>
                {sparkData.map((h, i) => (
                    <View
                        key={i}
                        style={[
                            styles.sparkBar,
                            {
                                height: Math.max(3, h * 20),
                                backgroundColor:
                                    i === sparkData.length - 1
                                        ? accentColor
                                        : accentColor + '40',
                            },
                        ]}
                    />
                ))}
            </View>
        </View>
    </View>
);

const StatsCarousel: React.FC<{ stats: DashboardStats | null }> = ({
    stats,
}) => {
    const statCards: StatCardConfig[] = useMemo(
        () => [
            { label: "Total Groups",    value: stats?.total_groups ?? 0,         accentColor: '#00d68f', icon: 'people',           sparkData: [0.3, 0.5, 0.4, 0.6, 0.7, 0.8, 1.0], trendUp: true  },
            { label: "Owned Groups",    value: stats?.owned_groups ?? 0,         accentColor: '#6eb5ff', icon: 'ribbon',           sparkData: [0.5, 0.6, 0.5, 0.7, 0.6, 0.9, 1.0], trendUp: true  },
            { label: "Member Groups",   value: stats?.member_groups ?? 0,        accentColor: '#00c896', icon: 'person-add',       sparkData: [0.4, 0.3, 0.5, 0.6, 0.5, 0.7, 0.8], trendUp: true  },
            { label: "Active Groups",   value: stats?.active_groups ?? 0,        accentColor: '#00d68f', icon: 'checkmark-circle', sparkData: [0.3, 0.5, 0.6, 0.5, 0.8, 0.7, 1.0], trendUp: true  },
            { label: "Pending Invites", value: stats?.pending_invitations ?? 0,  accentColor: '#f59e0b', icon: 'mail',             sparkData: [0.7, 0.5, 0.8, 0.6, 0.9, 0.6, 0.7], trendUp: false },
        ],
        [stats],
    );

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.balanceScrollContent}
            style={styles.balanceInfo}
        >
            {statCards.map((card) => (
                <StatCard key={card.label} {...card} />
            ))}
        </ScrollView>
    );
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <View style={styles.progressBarContainer}>
        <View
            style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]}
        />
    </View>
);

const GroupCard: React.FC<{
    group: Group;
    onPress?: () => void;
    showStatus?: boolean;
}> = ({ group, onPress, showStatus = false }) => {
    const memberProgress = calculateProgress(
        group.active_members,
        group.total_members,
    );

    const accentColor =
        memberProgress >= 70 ? '#00d68f' :
        memberProgress >= 40 ? '#6eb5ff' :
        '#f59e0b';

    return (
        <TouchableOpacity
            style={[styles.groupCard, shadowStyles]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            {/* Gradient background */}
            <LinearGradient
                colors={['#1e1e1e', accentColor + '20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Ghost icon */}
            <View style={styles.groupGhostIcon} pointerEvents="none">
                <Ionicons name="people" size={70} color={accentColor} />
            </View>

            {/* Header: progress badge + status icons */}
            <View style={styles.groupCardHeader}>
                <View style={[styles.groupBadge, {
                    backgroundColor: accentColor + '28',
                    borderColor: accentColor + '55',
                }]}>
                    <Text style={[styles.groupBadgeText, { color: accentColor }]}>
                        {Math.round(memberProgress)}%
                    </Text>
                </View>
                {showStatus && (
                    <View style={styles.statusContainer}>
                        {!group.is_active && (
                            <View style={[styles.statusIcon, styles.warningIcon]}>
                                <Ionicons
                                    name="warning"
                                    size={12}
                                    color={semanticColors.textInverse}
                                />
                            </View>
                        )}
                        {group.user_role === "admin" && (
                            <View style={[styles.statusIcon, styles.adminIcon]}>
                                <Ionicons
                                    name="shield"
                                    size={12}
                                    color={semanticColors.textInverse}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>

            <Text style={styles.groupTitle} numberOfLines={1}>
                {group.title}
            </Text>

            {showStatus && (
                <Text style={styles.groupSubtitle}>
                    {group.user_role === "admin" ? "Admin" : "Member"}
                </Text>
            )}

            <Text style={styles.groupAmount}>
                {formatCurrency(group.target_amount)}
            </Text>

            {/* Progress bar with dynamic accent color */}
            <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, {
                    width: `${Math.min(memberProgress, 100)}%`,
                    backgroundColor: accentColor,
                }]} />
            </View>

            <View style={styles.groupDetails}>
                <View>
                    <Text style={styles.groupDetailLabel}>
                        {showStatus ? "Duration" : "Owner"}
                    </Text>
                    <Text style={styles.groupDetailValue}>
                        {showStatus ? `${group.total_members} months` : group.owner}
                    </Text>
                </View>
                <View>
                    <Text style={styles.groupDetailLabel}>Members</Text>
                    <Text style={styles.groupDetailValue}>
                        {group.active_members}/{group.total_members}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const AddGroupButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.addGroupButton, shadowStyles]}
        activeOpacity={0.8}
    >
        <MaterialIcons
            name="format-list-bulleted-add"
            size={30}
            color={semanticColors.textInverse}
        />
    </TouchableOpacity>
);

const EmptyState: React.FC<{
    message: string;
    subtitle?: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    actionLabel?: string;
    onAction?: () => void;
}> = ({ message, subtitle, iconName, actionLabel, onAction }) => (
    <View style={styles.noRecordContainer}>
        {iconName && (
            <LG
                colors={["#e8f5e9", "#c8e6c9"]}
                style={styles.noRecordIconWrap}
            >
                <Ionicons name={iconName} size={28} color="#2e7d32" />
            </LG>
        )}
        <Text style={styles.noRecordTitle}>{message}</Text>
        {subtitle && (
            <Text style={styles.noRecordSubtitle}>{subtitle}</Text>
        )}
        {actionLabel && onAction && (
            <TouchableOpacity style={styles.noRecordAction} onPress={onAction} activeOpacity={0.8}>
                <Text style={styles.noRecordActionText}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

// ─── Upgrade Banner (free plan) ──────────────────────────────────────────────

const UpgradeBanner: React.FC<{
    planName: string;
    onUpgrade: () => void;
    onDismiss: () => void;
}> = ({ planName, onUpgrade, onDismiss }) => (
    <View style={styles.upgradeBannerCard}>
        <View style={styles.upgradeBannerIconWrap}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
        </View>
        <View style={styles.upgradeBannerTextBlock}>
            <Text style={styles.upgradeBannerTitle}>
                You're on {planName}
            </Text>
            <Text style={styles.upgradeBannerSubtitle}>
                Upgrade to Growth — unlimited groups &amp; smart reminders
            </Text>
        </View>
        <TouchableOpacity
            onPress={onUpgrade}
            style={styles.upgradeBannerCta}
            activeOpacity={0.8}
        >
            <Text style={styles.upgradeBannerCtaText}>Upgrade</Text>
        </TouchableOpacity>
        <TouchableOpacity
            onPress={onDismiss}
            style={styles.upgradeBannerDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
    </View>
);

// ─── No-Active-Plan Banner ────────────────────────────────────────────────────

const NoPlanBanner: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={styles.noPlanCard}
    >
        <LinearGradient
            colors={["#ffa94d", "#e07a10"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.noPlanGradient}
        >
            <View style={styles.noPlanIconWrap}>
                <Text style={styles.noPlanIcon}>⚡</Text>
            </View>
            <View style={styles.noPlanTextBlock}>
                <Text style={styles.noPlanTitle}>No active plan</Text>
                <Text style={styles.noPlanSubtitle}>
                    Unlock unlimited groups, smart reminders &amp; more
                </Text>
            </View>
            <Text style={styles.noPlanCta}>View plans →</Text>
        </LinearGradient>
    </TouchableOpacity>
);

const STATUS_COLORS: Record<string, string> = {
    verified: '#00d68f',
    pending:  '#f59e0b',
    rejected: '#ef4444',
};

const STATUS_ICONS: Record<string, string> = {
    verified: 'checkmark-circle',
    pending:  'time',
    rejected: 'close-circle',
};

function getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS: Array<readonly [string, string]> = [
    ['#00d68f', '#00bb7a'],
    ['#6eb5ff', '#3a8fd1'],
    ['#f59e0b', '#d97706'],
    ['#a78bfa', '#7c3aed'],
    ['#f87171', '#ef4444'],
];

function avatarGradient(name?: string): readonly [string, string] {
    const code = (name ?? '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

const ContributionCard: React.FC<{ contribution: GroupContribution }> = ({ contribution: c }) => {
    const statusColor = STATUS_COLORS[c.status] ?? '#888';
    const statusIcon  = STATUS_ICONS[c.status]  ?? 'ellipse-outline';
    const initials    = getInitials(c.user?.name);
    const grad        = avatarGradient(c.user?.name);
    const submittedAt = new Date(c.submitted_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
    const dueDate = new Date(c.due_date).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short',
    });

    return (
        <View style={styles.contribCard}>

            <View style={styles.contribInner}>
                {/* Top row: avatar + info + amount */}
                <View style={styles.contribTopRow}>
                    {/* Avatar */}
                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.contribAvatar}>
                        <Text style={styles.contribAvatarText}>{initials}</Text>
                    </LinearGradient>

                    {/* Middle info */}
                    <View style={styles.contribInfo}>
                        <Text style={styles.contribName} numberOfLines={1}>{c.user?.name ?? 'Contributor'}</Text>
                        <Text style={styles.contribGroup} numberOfLines={1}>
                            <Ionicons name="people-outline" size={11} color={semanticColors.textSecondary} />
                            {'  '}{c.group?.title ?? 'Group'}
                        </Text>
                    </View>

                    {/* Amount */}
                    <View style={styles.contribAmountBlock}>
                        <Text style={[styles.contribAmount, { color: statusColor }]}>
                            +{formatCurrency(c.amount)}
                        </Text>
                        <Text style={styles.contribDue}>due {dueDate}</Text>
                    </View>
                </View>

                {/* Bottom row: cycle badge + status pill + date */}
                <View style={styles.contribBottomRow}>
                    <View style={styles.contribCycleBadge}>
                        <Text style={styles.contribCycleText}>Cycle {c.cycle_number}</Text>
                    </View>

                    <View style={[styles.contribStatusPill, { backgroundColor: statusColor + '1a', borderColor: statusColor + '44' }]}>
                        <Ionicons name={statusIcon as any} size={11} color={statusColor} />
                        <Text style={[styles.contribStatusText, { color: statusColor }]}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </Text>
                    </View>

                    <Text style={styles.contribDate}>{submittedAt}</Text>
                </View>

                {/* Note (if present) */}
                {c.note ? (
                    <Text style={styles.contribNote} numberOfLines={1}>
                        "{c.note}"
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const TransactionsList: React.FC<{ contributions: GroupContribution[] }> = ({ contributions }) => {
    if (contributions.length === 0) {
        return (
            <View style={styles.contribEmpty}>
                <Ionicons name="receipt-outline" size={36} color={semanticColors.textSecondary} />
                <Text style={styles.contribEmptyText}>No contributions yet</Text>
            </View>
        );
    }

    return (
        <View style={styles.transactionsList}>
            {contributions.map((c) => (
                <ContributionCard key={c.id} contribution={c} />
            ))}
        </View>
    );
};

// ─── Cache Keys ───────────────────────────────────────────────────────────────

const CACHE_KEYS = {
    DASHBOARD_DATA: "cache_dashboard_data",
    DASHBOARD_TIMESTAMP: "cache_dashboard_timestamp",
};

const CACHE_DURATION = 30 * 1000; // 30 seconds - won't refetch if data is newer than this
const UPGRADE_BANNER_KEY = "upgrade_banner_dismissed_at";
const UPGRADE_BANNER_SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FREE_PLAN_NAMES = ["starter"]; // lowercase slugs treated as free/upgradeable

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

const useDashboardData = (
    navigation: NativeStackNavigationProp<RootStackParamList>,
) => {
    const [user, setUser] = useState<User | null>(null);
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [groupContributions, setGroupContributions] = useState<GroupContribution[]>([]);
    const [activePlanName, setActivePlanName] = useState<string>('No active plan');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [upgradeBannerVisible, setUpgradeBannerVisible] = useState(false);
    const lastFetchRef = useRef<number>(0);
    const isFetchingRef = useRef<boolean>(false);

    // Load cached data immediately on mount
    useEffect(() => {
        const loadCachedData = async () => {
            try {
                const [cachedData, userData, dismissedAt] = await Promise.all([
                    AsyncStorage.getItem(CACHE_KEYS.DASHBOARD_DATA),
                    AsyncStorage.getItem("user"),
                    AsyncStorage.getItem(UPGRADE_BANNER_KEY),
                ]);
                
                if (userData) setUser(JSON.parse(userData));
                
                if (cachedData) {
                    const { myGroups: cached_myGroups, stats: cached_stats, plan: cached_plan, group_contributions: cached_contributions } = JSON.parse(cachedData);
                    setMyGroups(cached_myGroups || []);
                    setStats(cached_stats || null);
                    setGroupContributions(cached_contributions || []);
                    if (cached_plan) {
                        setActivePlanName(cached_plan);
                        const isFreePlan = FREE_PLAN_NAMES.includes(cached_plan.toLowerCase());
                        const snoozed = dismissedAt
                            ? Date.now() - Number(dismissedAt) < UPGRADE_BANNER_SNOOZE_MS
                            : false;
                        if (isFreePlan && !snoozed) setUpgradeBannerVisible(true);
                    }
                    setLoading(false);
                }
            } catch (error) {
                // Silent fail for cache loading
            }
        };
        loadCachedData();
    }, []);

    const fetchData = useCallback(
        async (isRefresh = false, forceRefresh = false) => {
            // Prevent concurrent fetches
            if (isFetchingRef.current) return;
            
            // Skip if data was fetched recently (unless forced or manual refresh)
            const now = Date.now();
            if (!forceRefresh && !isRefresh && lastFetchRef.current > 0 && (now - lastFetchRef.current) < CACHE_DURATION) {
                setLoading(false);
                return;
            }

            try {
                isFetchingRef.current = true;
                if (isRefresh) setRefreshing(true);
                // Only show loading if we have no data yet
                else if (myGroups.length === 0) setLoading(true);

                const token = await AsyncStorage.getItem("token");
                if (!token) {
                    navigation.reset({ index: 0, routes: [{ name: "Signin" }] });
                    return;
                }

                const apiUrl = Constants.expoConfig?.extra?.apiUrl;
                if (!apiUrl) {
                    return;
                }

                const response = await axios.get<DashboardResponse>(
                    `${apiUrl}/user/dashboard`,
                    {
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    },
                );

                const {
                    user_groups = [],
                    stats: dashboardStats = {},
                    user: apiUser = null,
                    group_contributions = [],
                } = response.data;

                const planName: string = apiUser?.plan ?? 'No active plan';

                setMyGroups(user_groups);
                setStats(dashboardStats);
                setGroupContributions(group_contributions);
                setActivePlanName(planName);
                if (apiUser) setUser(apiUser);

                // Re-evaluate upgrade banner visibility with fresh plan
                const isFreePlan = FREE_PLAN_NAMES.includes(planName.toLowerCase());
                if (isFreePlan) {
                    const dismissedAt = await AsyncStorage.getItem(UPGRADE_BANNER_KEY);
                    const snoozed = dismissedAt
                        ? Date.now() - Number(dismissedAt) < UPGRADE_BANNER_SNOOZE_MS
                        : false;
                    setUpgradeBannerVisible(!snoozed);
                } else {
                    setUpgradeBannerVisible(false);
                }
                
                // Update last fetch timestamp
                lastFetchRef.current = Date.now();
                
                // Cache the data for instant loading next time
                await AsyncStorage.setItem(
                    CACHE_KEYS.DASHBOARD_DATA,
                    JSON.stringify({ myGroups: user_groups, stats: dashboardStats, plan: planName, group_contributions })
                );
            } catch (error: any) {
                if (error.response?.status === 401) {
                    await AsyncStorage.multiRemove(["token", "user"]);
                    navigation.reset({ index: 0, routes: [{ name: "Signin" }] });
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
                isFetchingRef.current = false;
            }
        },
        [navigation, myGroups.length],
    );

    const signOut = useCallback(async () => {
        try {
            await AsyncStorage.multiRemove(["token", "user", "tokenExpiresAt", CACHE_KEYS.DASHBOARD_DATA, CACHE_KEYS.DASHBOARD_TIMESTAMP]);
            navigation.reset({ index: 0, routes: [{ name: "Signin" }] });
        } catch (error) {
            // Silent fail for sign out
        }
    }, [navigation]);

    // Refetch data whenever the screen comes into focus (respects cache duration)
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const dismissUpgradeBanner = useCallback(async () => {
        setUpgradeBannerVisible(false);
        await AsyncStorage.setItem(UPGRADE_BANNER_KEY, String(Date.now()));
    }, []);

    return {
        user,
        myGroups,
        stats,
        groupContributions,
        activePlanName,
        upgradeBannerVisible,
        dismissUpgradeBanner,
        loading,
        refreshing,
        refetch: () => fetchData(true, true),
        signOut,
    };
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const actionSheetRef = useRef<ActionSheetRef>(null);

    const {
        user,
        myGroups,
        stats,
        groupContributions,
        activePlanName,
        upgradeBannerVisible,
        dismissUpgradeBanner,
        loading,
        refreshing,
        refetch,
        signOut,
    } = useDashboardData(navigation);

    const handleSignOut = useCallback(async () => {
        actionSheetRef.current?.hide();
        await signOut();
    }, [signOut]);

    const handleMenuPress = useCallback(() => {
        actionSheetRef.current?.show();
    }, []);

    const handleGroupPress = useCallback(
        (groupId: string, userRole?: string, isActive?: boolean) => {
            navigation.navigate("GroupDetails", {
                group_id: groupId,
                initial_role: userRole,
                initial_is_active: isActive,
            });
        },
        [navigation],
    );

    const handleCreateGroup = useCallback(() => {
        navigation.navigate("CreateGroup");
    }, [navigation]);

    const renderMyGroups = useMemo(
        () => (
            <>
                {myGroups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        showStatus
                        onPress={() => handleGroupPress(group.id, group.user_role, group.is_active)}
                    />
                ))}
                <AddGroupButton onPress={handleCreateGroup} />
            </>
        ),
        [myGroups, handleGroupPress, handleCreateGroup],
    );

    if (loading) {
        return (
            <SafeAreaProvider>
                <StatusBar
                    barStyle="light-content"
                    backgroundColor="transparent"
                    translucent
                />
                <View style={styles.container}>
                    <LoadingView />
                </View>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent
            />
            <View style={styles.container}>
                {/* Fixed Header */}
                <Header userName={user?.name} onMenuPress={handleMenuPress} />

                <MenuActionSheet
                    actionSheetRef={actionSheetRef as React.RefObject<ActionSheetRef>}
                    onSignOut={handleSignOut}
                    unreadNotifications={stats?.unread_notifications ?? 0}
                    userName={user?.name}
                />

                {/* Scrollable Content */}
                <ScrollView
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refetch}
                            tintColor={semanticColors.buttonPrimary}
                            colors={[semanticColors.buttonPrimary]}
                        />
                    }
                >
                    <StatsCarousel stats={stats} />

                    {/* No-active-plan alert card */}
                    {activePlanName === 'No active plan' && (
                        <NoPlanBanner onPress={() => navigation.navigate('PlanPicker')} />
                    )}

                    {/* Upgrade nudge for free plan users */}
                    {activePlanName !== 'No active plan' && upgradeBannerVisible && (
                        <UpgradeBanner
                            planName={activePlanName}
                            onUpgrade={() => navigation.navigate('PlanPicker')}
                            onDismiss={dismissUpgradeBanner}
                        />
                    )}

                    <Text style={[styles.sectionTitle, styles.boldText]}>Groups</Text>

                    <View style={styles.groupsContainer}>
                        {myGroups.length === 0 ? (
                            <EmptyState
                                message="No groups yet"
                                subtitle="Create a group and invite others to start saving together."
                                iconName="people-outline"
                                actionLabel="Create a Group"
                                onAction={handleCreateGroup}
                            />
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.horizontalScroll}
                            >
                                {renderMyGroups}
                            </ScrollView>
                        )}
                    </View>

                    <Text style={[styles.sectionTitle, styles.boldText]}>
                        Recent Transactions
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                        Your latest group contributions
                    </Text>

                    <TransactionsList contributions={groupContributions} />

                    {/* Bottom spacing */}
                    <View style={styles.bottomSpacer} />
                </ScrollView>
            </View>
        </SafeAreaProvider>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const shadowStyles = Platform.select({
    ios: {
        shadowColor: semanticColors.shadowColor,
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    android: { elevation: 5 },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    scrollContent: {
        flex: 1,
    },
    bottomSpacer: {
        height: 30,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: semanticColors.background,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: semanticColors.textPrimary,
        fontWeight: "500",
    },

    // Header - Fixed at top
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: (StatusBar.currentHeight ?? 40) + 10,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: semanticColors.background,
        borderBottomWidth: 1,
        borderBottomColor: semanticColors.borderLight,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
    },
    headerTextContainer: {
        flex: 1,
        flexDirection: "column",
        alignItems: "flex-start",
        paddingVertical: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: semanticColors.textPrimary,
    },
    subtitle: {
        color: semanticColors.textSecondary,
        marginTop: 4,
    },
    menuButton: {
        marginLeft: "auto",
    },
    hamburgerButton: {
        width: 42,
        height: 42,
        backgroundColor: semanticColors.containerBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: semanticColors.border,
        justifyContent: "center",
        alignItems: "center",
        gap: 5,
    },
    hamburgerLine: {
        width: 18,
        height: 2,
        backgroundColor: semanticColors.textPrimary,
        borderRadius: 1,
    },

    // Stats Carousel
    balanceInfo: {
        paddingHorizontal: 20,
        paddingVertical: 26,
        marginVertical: 6,
    },
    balanceScrollContent: {
        paddingRight: 20,
        alignItems: "center",
        gap: 12,
    },
    statCard: {
        width: 152,
        height: 162,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    statGhostIcon: {
        position: "absolute",
        right: -15,
        bottom: -10,
        opacity: 0.09,
        transform: [{ rotate: "-12deg" }],
    },
    statCardInner: {
        flex: 1,
        padding: 14,
        justifyContent: "space-between",
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    statValueRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
    },
    statValue: {
        fontSize: 32,
        fontWeight: "800",
        lineHeight: 36,
        color: "#ffffff",
    },
    statTrendPill: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 2,
        justifyContent: "center",
        alignItems: "center",
    },
    statLabel: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 10,
        fontWeight: "500",
        lineHeight: 13,
        marginTop: -2,
    },
    sparkline: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 3,
        height: 22,
    },
    sparkBar: {
        flex: 1,
        borderRadius: 2,
    },

    // Groups
    groupsContainer: {
        backgroundColor: semanticColors.containerBackground,
        paddingVertical: 6,
        marginHorizontal: 20,
        marginVertical: 15,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: semanticColors.borderLight,
    },
    horizontalScroll: {
        paddingVertical: 10,
        marginHorizontal: 20,
    },
    groupCard: {
        overflow: "hidden",
        padding: 18,
        marginRight: 15,
        width: 200,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    groupGhostIcon: {
        position: "absolute",
        right: -14,
        bottom: -10,
        opacity: 0.08,
        transform: [{ rotate: "-10deg" }],
    },
    groupCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    groupBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    groupBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    statusContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    statusIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: "center",
        alignItems: "center",
    },
    warningIcon: {
        backgroundColor: semanticColors.warning,
    },
    adminIcon: {
        backgroundColor: semanticColors.buttonPrimary,
        marginLeft: 6,
    },
    groupTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: semanticColors.textPrimary,
        lineHeight: 20,
        marginBottom: 3,
    },
    groupSubtitle: {
        fontSize: 11,
        color: semanticColors.textMuted,
        marginBottom: 10,
        fontWeight: "500",
    },
    groupAmount: {
        fontSize: 20,
        fontWeight: "800",
        color: "#ffffff",
        marginTop: 10,
        marginBottom: 10,
    },
    progressBarContainer: {
        height: 5,
        backgroundColor: semanticColors.progressBackground,
        borderRadius: 3,
        marginVertical: 14,
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        backgroundColor: semanticColors.progressFill,
        borderRadius: 3,
    },
    groupDetails: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    groupDetailLabel: {
        color: semanticColors.iconMuted,
        fontSize: 10,
        marginBottom: 3,
    },
    groupDetailValue: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 12,
        fontWeight: "600",
    },
    addGroupButton: {
        backgroundColor: semanticColors.buttonPrimary,
        padding: 15,
        marginRight: 15,
        height: 70,
        width: 70,
        alignSelf: "center",
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
    },

    // Section Title
    sectionTitle: {
        fontSize: 20,
        fontWeight: "800",
        marginTop: 6,
        marginBottom: 2,
        color: "#ffffff",
        paddingHorizontal: 20,
        letterSpacing: -0.2,
    },
    boldText: {
        fontWeight: "800",
    },
    sectionSubtitle: {
        fontSize: 13,
        color: semanticColors.textSecondary,
        paddingHorizontal: 20,
        marginTop: 2,
        marginBottom: 4,
    },

    // Transactions / Contributions
    transactionsList: {
        marginHorizontal: 20,
        marginVertical: 10,
        marginBottom: 6,
        gap: 12,
    },
    contribCard: {
        flexDirection: 'row',
        backgroundColor: semanticColors.containerBackground,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: semanticColors.borderLight,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10 },
            android: { elevation: 4 },
        }),
    },
    contribInner: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
    },
    contribTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    contribAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    contribAvatarText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    contribInfo: {
        flex: 1,
        gap: 3,
    },
    contribName: {
        color: semanticColors.textPrimary,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    contribGroup: {
        color: semanticColors.textSecondary,
        fontSize: 12,
    },
    contribAmountBlock: {
        alignItems: 'flex-end',
        gap: 2,
    },
    contribAmount: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    contribDue: {
        fontSize: 10,
        color: semanticColors.textSecondary,
    },
    contribBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    contribCycleBadge: {
        backgroundColor: 'rgba(110,181,255,0.12)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: 'rgba(110,181,255,0.25)',
    },
    contribCycleText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6eb5ff',
    },
    contribStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
    },
    contribStatusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    contribDate: {
        fontSize: 10,
        color: semanticColors.textSecondary,
        marginLeft: 'auto',
    },
    contribNote: {
        fontSize: 11,
        color: semanticColors.textSecondary,
        fontStyle: 'italic',
        paddingTop: 2,
    },
    contribEmpty: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 10,
    },
    contribEmptyText: {
        color: semanticColors.textSecondary,
        fontSize: 14,
    },

    // Empty State
    noRecordContainer: {
        alignItems: "center",
        paddingVertical: 20,
        paddingHorizontal: 20,
        width: "100%",
    },
    noRecordIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },
    noRecordTitle: {
        fontSize: 14,
        color: semanticColors.textPrimary,
        textAlign: "center",
        fontWeight: "600",
        marginBottom: 4,
    },
    noRecordSubtitle: {
        fontSize: 12,
        color: semanticColors.textSecondary,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 14,
        alignSelf: "stretch",
    },
    noRecordAction: {
        backgroundColor: semanticColors.buttonPrimary,
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 16,
    },
    noRecordActionText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
    },
    /** @deprecated use noRecordTitle */
    noRecordText: {
        fontSize: 16,
        color: semanticColors.textSecondary,
        textAlign: "center",
        marginBottom: 10,
        fontWeight: "500",
    },

    // ── No-active-plan banner ────────────────────────────────────────────────
    noPlanCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 16,
        overflow: "hidden",
        ...Platform.select({
            ios: {
                shadowColor:   "#ffa94d",
                shadowOffset:  { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius:  12,
            },
            android: { elevation: 6 },
        }),
    },
    noPlanGradient: {
        flexDirection:  "row",
        alignItems:     "center",
        paddingVertical:   14,
        paddingHorizontal: 16,
        gap:            12,
    },
    noPlanIconWrap: {
        width:          38,
        height:         38,
        borderRadius:   12,
        backgroundColor: "rgba(255,255,255,0.20)",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
    },
    noPlanIcon: {
        fontSize: 18,
    },
    noPlanTextBlock: {
        flex: 1,
    },
    noPlanTitle: {
        fontSize:   14,
        fontWeight: "800",
        color:      "#fff",
        marginBottom: 2,
    },
    noPlanSubtitle: {
        fontSize:   11,
        color:      "rgba(255,255,255,0.80)",
        lineHeight: 15,
    },
    noPlanCta: {
        fontSize:   12,
        fontWeight: "700",
        color:      "#fff",
        flexShrink: 0,
    },

    // ─── Upgrade Banner ──────────────────────────────────────────────────────────
    upgradeBannerCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: "#242424",
        borderWidth: 1,
        borderColor: "rgba(0,214,143,0.3)",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 10,
        ...Platform.select({
            ios: {
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: { elevation: 4 },
        }),
    },
    upgradeBannerGradient: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    upgradeBannerIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: "rgba(0,214,143,0.15)",
        borderWidth: 1,
        borderColor: "rgba(0,214,143,0.3)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    upgradeBannerTextBlock: {
        flex: 1,
    },
    upgradeBannerTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#ffffff",
        marginBottom: 2,
    },
    upgradeBannerSubtitle: {
        fontSize: 11,
        color: "rgba(255,255,255,0.5)",
        lineHeight: 15,
    },
    upgradeBannerCta: {
        backgroundColor: "#00d68f",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        flexShrink: 0,
    },
    upgradeBannerCtaText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#0a1a0f",
    },
    upgradeBannerDismiss: {
        paddingLeft: 6,
        flexShrink: 0,
    },
});

export default DashboardScreen;
