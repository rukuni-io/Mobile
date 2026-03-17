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
    GroupDetails: { group_id: number };
    PlanPicker: undefined;
};

interface Group {
    id: number;
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

interface DashboardResponse {
    suggested_groups?: Group[];
    user_groups?: Group[];
    stats?: DashboardStats;
    user?: User;
    plan?: string; // 'No active plan' or plan name e.g. 'Growth'
}

interface StatCardConfig {
    label: string;
    value: number;
    colors: readonly [string, string];
}

type TabType = "topGroups" | "myGroup";

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

const StatCard: React.FC<StatCardConfig> = ({ label, value, colors }) => (
    <View style={styles.statCard}>
        <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCardInner}
        >
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </LinearGradient>
    </View>
);

const StatsCarousel: React.FC<{ stats: DashboardStats | null }> = ({
    stats,
}) => {
    const statCards: StatCardConfig[] = useMemo(
        () => [
            {
                label: "Total Groups",
                value: stats?.total_groups ?? 0,
                colors: semanticColors.gradientPrimary,
            },
            {
                label: "Owned Groups",
                value: stats?.owned_groups ?? 0,
                colors: semanticColors.gradientSecondary,
            },
            {
                label: "Member Groups",
                value: stats?.member_groups ?? 0,
                colors: semanticColors.gradientPurple,
            },
            {
                label: "Active Groups",
                value: stats?.active_groups ?? 0,
                colors: semanticColors.gradientSuccess,
            },
            {
                label: "Pending Invites",
                value: stats?.pending_invitations ?? 0,
                colors: semanticColors.gradientWarning,
            },
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

    return (
        <TouchableOpacity
            style={[styles.groupCard, shadowStyles]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.groupCardHeader}>
                <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>
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

            <ProgressBar progress={memberProgress} />

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

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <View style={styles.noRecordContainer}>
        <Text style={styles.noRecordText}>{message}</Text>
    </View>
);

// ─── Upgrade Banner (free plan) ──────────────────────────────────────────────

const UpgradeBanner: React.FC<{
    planName: string;
    onUpgrade: () => void;
    onDismiss: () => void;
}> = ({ planName, onUpgrade, onDismiss }) => (
    <View style={styles.upgradeBannerCard}>
        <LinearGradient
            colors={["#2a1d6e", "#1a2a6e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeBannerGradient}
        >
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
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
        </LinearGradient>
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

const TabHeader: React.FC<{
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}> = ({ activeTab, onTabChange }) => {
    const tabs: { key: TabType; label: string }[] = [
        { key: "topGroups", label: "Explore" },
        { key: "myGroup", label: "A Member" },
    ];

    return (
        <View style={styles.tabHeadersContainer}>
            {tabs.map(({ key, label }) => (
                <TouchableOpacity
                    key={key}
                    style={styles.tabButton}
                    onPress={() => onTabChange(key)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[styles.tabText, activeTab === key && styles.activeTabText]}
                    >
                        {label}
                    </Text>
                    {activeTab === key && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
            ))}
        </View>
    );
};

const TransactionItem: React.FC<{
    title: string;
    date: string;
    amount: string;
    type: "credit" | "debit";
    gradientColors: readonly [string, string];
}> = ({ title, date, amount, type, gradientColors }) => (
    <View style={[styles.transactionItem, shadowStyles]}>
        <View style={styles.transactionDetails}>
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.transactionIcon}
            >
                <Ionicons
                    name={type === "credit" ? "arrow-down" : "arrow-up"}
                    size={20}
                    color={semanticColors.textInverse}
                />
            </LinearGradient>
            <View style={styles.transactionText}>
                <Text style={styles.transactionTitle}>{title}</Text>
                <Text style={styles.transactionDate}>{date}</Text>
            </View>
        </View>
        <Text
            style={[
                styles.transactionAmount,
                {
                    color:
                        type === "credit" ? semanticColors.success : semanticColors.danger,
                },
            ]}
        >
            {type === "credit" ? "+" : "-"}
            {amount}
        </Text>
    </View>
);

const TransactionsList: React.FC = () => {
    const transactions = useMemo(
        () => [
            {
                id: 1,
                title: "Group Contribution",
                date: "Oct 12, 2023",
                amount: "£15,000.00",
                type: "credit" as const,
                colors: semanticColors.gradientPrimary,
            },
            {
                id: 2,
                title: "Monthly Payment",
                date: "Oct 10, 2023",
                amount: "£500.00",
                type: "debit" as const,
                colors: semanticColors.gradientSuccess,
            },
            {
                id: 3,
                title: "Payout Received",
                date: "Sep 28, 2023",
                amount: "£6,000.00",
                type: "credit" as const,
                colors: semanticColors.gradientWarning,
            },
            {
                id: 4,
                title: "Group Contribution",
                date: "Sep 12, 2023",
                amount: "£15,000.00",
                type: "credit" as const,
                colors: semanticColors.gradientPrimary,
            },
            {
                id: 5,
                title: "Monthly Payment",
                date: "Sep 10, 2023",
                amount: "£500.00",
                type: "debit" as const,
                colors: semanticColors.gradientSuccess,
            },
        ],
        [],
    );

    return (
        <View style={styles.transactionsList}>
            {transactions.map((tx) => (
                <TransactionItem
                    key={tx.id}
                    title={tx.title}
                    date={tx.date}
                    amount={tx.amount}
                    type={tx.type}
                    gradientColors={tx.colors}
                />
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
    const [topGroups, setTopGroups] = useState<Group[]>([]);
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
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
                    const { topGroups: cached_topGroups, myGroups: cached_myGroups, stats: cached_stats, plan: cached_plan } = JSON.parse(cachedData);
                    setTopGroups(cached_topGroups || []);
                    setMyGroups(cached_myGroups || []);
                    setStats(cached_stats || null);
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
                else if (topGroups.length === 0 && myGroups.length === 0) setLoading(true);

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
                    suggested_groups = [],
                    user_groups = [],
                    stats: dashboardStats = {},
                    user: apiUser = null,
                } = response.data;

                const planName: string = apiUser?.plan ?? 'No active plan';

                setTopGroups(suggested_groups);
                setMyGroups(user_groups);
                setStats(dashboardStats);
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
                    JSON.stringify({ topGroups: suggested_groups, myGroups: user_groups, stats: dashboardStats, plan: planName })
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
        [navigation, topGroups.length, myGroups.length],
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
        topGroups,
        myGroups,
        stats,
        activePlanName,
        upgradeBannerVisible,
        dismissUpgradeBanner,
        loading,
        refreshing,
        refetch: () => fetchData(true, true), // Force refresh on pull-to-refresh
        signOut,
    };
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const actionSheetRef = useRef<ActionSheetRef>(null);
    const [activeTab, setActiveTab] = useState<TabType>("topGroups");

    const {
        user,
        topGroups,
        myGroups,
        stats,
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
        (groupId: number) => {
            navigation.navigate("GroupDetails", { group_id: groupId });
        },
        [navigation],
    );

    const handleCreateGroup = useCallback(() => {
        navigation.navigate("CreateGroup");
    }, [navigation]);

    const renderExploreGroups = useMemo(() => {
        if (topGroups.length === 0) {
            return <EmptyState message="No groups found" />;
        }
        return topGroups.map((group) => (
            <GroupCard
                key={group.id}
                group={group}
                onPress={() => handleGroupPress(group.id)}
            />
        ));
    }, [topGroups, handleGroupPress]);

    const renderMyGroups = useMemo(
        () => (
            <>
                {myGroups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        showStatus
                        onPress={() => handleGroupPress(group.id)}
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
                        <TabHeader activeTab={activeTab} onTabChange={setActiveTab} />

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.horizontalScroll}
                        >
                            {activeTab === "topGroups" ? renderExploreGroups : renderMyGroups}
                        </ScrollView>
                    </View>

                    <Text style={[styles.sectionTitle, styles.boldText]}>
                        Recent Transactions
                    </Text>

                    <TransactionsList />

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
        paddingVertical: 30,
        marginVertical: 10,
    },
    balanceScrollContent: {
        paddingRight: 20,
        alignItems: "center",
        gap: 14,
    },
    statCard: {
        width: 120,
        height: 120,
        borderRadius: 15,
        overflow: "hidden",
    },
    statCardInner: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 15,
    },
    statLabel: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 6,
        textAlign: "center",
        letterSpacing: 0.4,
        lineHeight: 15,
    },
    statValue: {
        color: semanticColors.textInverse,
        fontSize: 28,
        fontWeight: "800",
        textAlign: "center",
        lineHeight: 34,
    },

    // Tabs
    tabHeadersContainer: {
        flexDirection: "row",
        marginHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: semanticColors.borderLight,
    },
    tabButton: {
        paddingVertical: 12,
        marginHorizontal: 5,
        paddingBottom: 16,
        position: "relative",
    },
    tabText: {
        color: semanticColors.textSecondary,
        fontWeight: "600",
        fontSize: 13,
    },
    activeTabText: {
        color: semanticColors.buttonPrimary,
    },
    tabUnderline: {
        position: "absolute",
        bottom: -1,
        left: 5,
        right: 5,
        height: 2,
        backgroundColor: semanticColors.buttonPrimary,
        borderRadius: 1,
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
        backgroundColor: semanticColors.cardBackground,
        padding: 18,
        marginRight: 15,
        width: 195,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: semanticColors.border,
    },
    groupCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    groupBadge: {
        backgroundColor: semanticColors.accentLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: semanticColors.accentLight,
    },
    groupBadgeText: {
        color: semanticColors.accent,
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
        color: semanticColors.textInverse,
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
        fontSize: 18,
        fontWeight: "700",
        marginVertical: 5,
        color: semanticColors.textPrimary,
        paddingHorizontal: 20,
    },
    boldText: {
        fontWeight: "bold",
    },

    // Transactions
    transactionsList: {
        marginHorizontal: 5,
        marginVertical: 10,
        padding: 10,
    },
    transactionItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 18,
        marginBottom: 12,
        backgroundColor: semanticColors.containerBackground,
        borderWidth: 1,
        borderColor: semanticColors.borderLight,
        borderRadius: 16,
    },
    transactionDetails: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    transactionIcon: {
        borderRadius: 14,
        width: 50,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    transactionText: {
        marginLeft: 15,
    },
    transactionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: semanticColors.textPrimary,
    },
    transactionDate: {
        color: semanticColors.textSecondary,
        marginTop: 3,
        fontSize: 11,
    },
    transactionAmount: {
        fontSize: 15,
        fontWeight: "700",
    },

    // Empty State
    noRecordContainer: {
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 22,
        width: "100%",
    },
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
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(124,140,255,0.25)",
        ...Platform.select({
            ios: {
                shadowColor: "#7c8cff",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
            },
            android: { elevation: 5 },
        }),
    },
    upgradeBannerGradient: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 14,
        gap: 10,
    },
    upgradeBannerIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: "rgba(124,140,255,0.25)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    upgradeBannerTextBlock: {
        flex: 1,
    },
    upgradeBannerTitle: {
        fontSize: 13,
        fontWeight: "800",
        color: "#fff",
        marginBottom: 2,
    },
    upgradeBannerSubtitle: {
        fontSize: 10,
        color: "rgba(255,255,255,0.72)",
        lineHeight: 14,
    },
    upgradeBannerCta: {
        backgroundColor: "rgba(124,140,255,0.35)",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        flexShrink: 0,
    },
    upgradeBannerCtaText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#fff",
    },
    upgradeBannerDismiss: {
        paddingLeft: 6,
        flexShrink: 0,
    },
});

export default DashboardScreen;
