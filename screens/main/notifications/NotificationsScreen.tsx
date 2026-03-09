import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Animated,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────
interface ApiNotification {
    id: string;
    type: string;
    notifiable_type: string;
    notifiable_id: number;
    data: {
        type?: string;
        title?: string;
        message?: string;
        group_id?: number;
        group_title?: string;
        group_name?: string;
        user_id?: number;
        user_name?: string;
        amount?: string;
        // Login notification specific fields
        ip_address?: string;
        user_agent?: string;
        device?: string;
        login_time?: string;
        is_new_device?: boolean;
        [key: string]: any;
    };
    read_at: string | null;
    created_at: string;
    updated_at: string;
}

interface Notification {
    id: string;
    type: string;
    groupId: number | null;
    title: string;
    body: string;
    icon: string;
    color: string;
    colorSoft: string;
    time: string;
    read: boolean;
    groupTitle: string | null;
    cta: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const AVATAR_PALETTE = [
    { bg: 'rgba(124, 140, 255, 0.15)', fg: '#7c8cff' },
    { bg: 'rgba(56, 217, 169, 0.15)', fg: '#38d9a9' },
    { bg: 'rgba(255, 169, 77, 0.15)', fg: '#ffa94d' },
    { bg: 'rgba(255, 107, 107, 0.15)', fg: '#ff6b6b' },
    { bg: 'rgba(192, 132, 252, 0.15)', fg: '#c084fc' },
];

const getAvatarColor = (id: number) => AVATAR_PALETTE[(id || 0) % AVATAR_PALETTE.length];

// ── Notification Type Config ──────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG: { [key: string]: { icon: string; color: string; colorSoft: string; cta: string } } = {
    login: { icon: '🔐', color: '#7c8cff', colorSoft: 'rgba(124,140,255,0.1)', cta: 'View Details' },
    group_created: { icon: '🏦', color: '#7c8cff', colorSoft: 'rgba(124,140,255,0.1)', cta: 'View Group' },
    group_joined: { icon: '🏦', color: '#7c8cff', colorSoft: 'rgba(124,140,255,0.1)', cta: 'View Group' },
    group_join_request: { icon: '👋', color: '#ffa94d', colorSoft: 'rgba(255,169,77,0.08)', cta: 'Review' },
    member_joined: { icon: '✅', color: '#38d9a9', colorSoft: 'rgba(56,217,169,0.1)', cta: 'View Group' },
    member_pending: { icon: '⏳', color: '#ffa94d', colorSoft: 'rgba(255,169,77,0.08)', cta: 'Remind' },
    invitation_pending: { icon: '⏳', color: '#ffa94d', colorSoft: 'rgba(255,169,77,0.08)', cta: 'Remind' },
    invitation_accepted: { icon: '✅', color: '#38d9a9', colorSoft: 'rgba(56,217,169,0.1)', cta: 'View Group' },
    invitation_declined: { icon: '❌', color: '#ff6b6b', colorSoft: 'rgba(255,107,107,0.08)', cta: 'View Group' },
    group_starting: { icon: '🚀', color: '#c084fc', colorSoft: 'rgba(192, 132, 252, 0.1)', cta: 'View Schedule' },
    payment_due: { icon: '💳', color: '#ff6b6b', colorSoft: 'rgba(255,107,107,0.08)', cta: 'Pay Now' },
    payment_received: { icon: '💰', color: '#38d9a9', colorSoft: 'rgba(56,217,169,0.1)', cta: 'View Details' },
    payment_reminder: { icon: '⏰', color: '#ffa94d', colorSoft: 'rgba(255,169,77,0.08)', cta: 'Pay Now' },
    payout_received: { icon: '🎉', color: '#38d9a9', colorSoft: 'rgba(56,217,169,0.1)', cta: 'View Details' },
    default: { icon: '🔔', color: '#7c8cff', colorSoft: 'rgba(124,140,255,0.1)', cta: 'View' },
};

// ── Extract notification type from Laravel class name or data ─────────────────
function extractNotificationType(apiNotif: ApiNotification): string {
    // First check if data.type is set
    if (apiNotif.data?.type) {
        return apiNotif.data.type;
    }
    
    // Extract from Laravel notification class name: "App\\Notifications\\GroupJoinRequestNotification" -> "group_join_request"
    if (apiNotif.type) {
        const className = apiNotif.type.split('\\').pop() || '';
        // Remove "Notification" suffix and convert PascalCase to snake_case
        const withoutSuffix = className.replace(/Notification$/, '');
        const snakeCase = withoutSuffix
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
        return snakeCase;
    }
    
    return 'default';
}

// ── Map API Notification to UI Format ─────────────────────────────────────────
function mapApiNotification(apiNotif: ApiNotification): Notification {
    const notifType = extractNotificationType(apiNotif);
    const config = NOTIF_TYPE_CONFIG[notifType] || NOTIF_TYPE_CONFIG.default;
    
    // Build title from data or generate from type
    let title = apiNotif.data?.title;
    if (!title) {
        // Convert snake_case to Title Case
        title = notifType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    // Build body message - for login notifications, include device info
    let body = apiNotif.data?.message || '';
    if (notifType === 'login' && apiNotif.data) {
        const device = apiNotif.data.device || 'Unknown Device';
        const ipAddress = apiNotif.data.ip_address || '';
        if (ipAddress) {
            body = `${body}\nDevice: ${device}\nIP: ${ipAddress}`;
        }
    }
    
    return {
        id: apiNotif.id,
        type: notifType,
        groupId: apiNotif.data?.group_id || null,
        title,
        body,
        icon: config.icon,
        color: config.color,
        colorSoft: config.colorSoft,
        time: apiNotif.created_at,
        read: apiNotif.read_at !== null,
        groupTitle: apiNotif.data?.group_title || apiNotif.data?.group_name || null,
        cta: config.cta,
    };
}

// ── Filter Tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'group_created', label: 'Groups' },
    { key: 'member_pending', label: 'Pending' },
    { key: 'payment_due', label: 'Payments' },
];

// ── Notification Card Component ───────────────────────────────────────────────
const NotifCard = ({
    notif,
    onRead,
    onAction,
}: {
    notif: Notification;
    onRead: (id: string) => void;
    onAction: (notif: Notification) => void;
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const col = getAvatarColor(notif.groupId ?? 0);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View
            style={[
                cardStyles.container,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
                    borderColor: notif.read ? D.border : notif.color + '40',
                    borderLeftColor: notif.read ? D.border : notif.color,
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onRead(notif.id)}
                style={cardStyles.inner}
            >
                {/* Unread glow strip */}
                {!notif.read && (
                    <LinearGradient
                        colors={[notif.color, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={cardStyles.glowStrip}
                    />
                )}

                <View style={cardStyles.row}>
                    {/* Icon bubble */}
                    <View style={[cardStyles.iconBubble, { backgroundColor: notif.colorSoft, borderColor: notif.color + '30' }]}>
                        <Text style={cardStyles.iconEmoji}>{notif.icon}</Text>
                    </View>

                    {/* Content */}
                    <View style={cardStyles.content}>
                        <View style={cardStyles.header}>
                            <Text
                                style={[
                                    cardStyles.title,
                                    { fontWeight: notif.read ? '600' : '700', color: notif.read ? D.textSub : D.text },
                                ]}
                                numberOfLines={1}
                            >
                                {notif.title}
                            </Text>
                            <View style={cardStyles.timeRow}>
                                {!notif.read && (
                                    <View style={[cardStyles.unreadDot, { backgroundColor: notif.color }]} />
                                )}
                                <Text style={cardStyles.time}>{relTime(notif.time)}</Text>
                            </View>
                        </View>

                        <Text style={cardStyles.body} numberOfLines={2}>
                            {notif.body}
                        </Text>

                        {/* Footer */}
                        <View style={cardStyles.footer}>
                            {notif.groupTitle && (
                                <View style={[cardStyles.groupPill, { backgroundColor: col.bg, borderColor: col.fg + '25' }]}>
                                    <Text style={[cardStyles.groupPillText, { color: col.fg }]}>{notif.groupTitle}</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                onPress={() => onAction(notif)}
                                style={[cardStyles.ctaButton, { borderColor: notif.color + '50' }]}
                            >
                                <Text style={[cardStyles.ctaText, { color: notif.color }]}>{notif.cta} →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const cardStyles = StyleSheet.create({
    container: {
        backgroundColor: D.surface,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
    },
    inner: {
        padding: 16,
        paddingBottom: 14,
    },
    glowStrip: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        opacity: 0.6,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBubble: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: {
        fontSize: 20,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    title: {
        fontSize: 13,
        letterSpacing: 0.1,
        flex: 1,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 8,
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    time: {
        fontSize: 10,
        color: D.textMuted,
    },
    body: {
        fontSize: 12,
        color: D.textSub,
        lineHeight: 18,
        marginBottom: 10,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupPill: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
    },
    groupPillText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    ctaButton: {
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    ctaText: {
        fontSize: 11,
        fontWeight: '700',
    },
});

// ── Stats Bar Component ───────────────────────────────────────────────────────
const StatBar = ({ notifs }: { notifs: Notification[] }) => {
    const unread = notifs.filter(n => !n.read).length;
    const pending = notifs.filter(n => n.type === 'member_pending').length;
    const due = notifs.filter(n => n.type === 'payment_due').length;

    const stats = [
        { label: 'Unread', value: unread, color: D.accent, icon: '🔔' },
        { label: 'Pending', value: pending, color: D.warn, icon: '⏳' },
        { label: 'Due', value: due, color: D.danger, icon: '💳' },
    ];

    return (
        <View style={statStyles.container}>
            {stats.map(s => (
                <View
                    key={s.label}
                    style={[
                        statStyles.card,
                        { borderColor: s.value > 0 ? s.color + '40' : D.border },
                    ]}
                >
                    <Text style={statStyles.icon}>{s.icon}</Text>
                    <Text style={[statStyles.value, { color: s.value > 0 ? s.color : D.textMuted }]}>
                        {s.value}
                    </Text>
                    <Text style={statStyles.label}>{s.label.toUpperCase()}</Text>
                </View>
            ))}
        </View>
    );
};

const statStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        backgroundColor: D.surface,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    icon: {
        fontSize: 18,
        marginBottom: 4,
    },
    value: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 2,
    },
    label: {
        fontSize: 10,
        color: D.textMuted,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
});

// ── Cache Keys ────────────────────────────────────────────────────────────────
const CACHE_KEYS = {
    NOTIFICATIONS_DATA: "cache_notifications_data",
};
const CACHE_DURATION = 15 * 1000; // 15 seconds

// ── Main Screen ───────────────────────────────────────────────────────────────
const NotificationsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [allNotifs, setAllNotifs] = useState<Notification[]>([]);
    const [filter, setFilter] = useState('all');
    const [toast, setToast] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const toastAnim = useRef(new Animated.Value(0)).current;
    const tokenRef = useRef<string | null>(null);
    const apiUrlRef = useRef<string | null>(null);
    const lastFetchRef = useRef<number>(0);
    const isFetchingRef = useRef<boolean>(false);

    // Load cached data immediately on mount
    useEffect(() => {
        const loadCachedData = async () => {
            try {
                const cachedData = await AsyncStorage.getItem(CACHE_KEYS.NOTIFICATIONS_DATA);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setAllNotifs(parsed);
                    setLoading(false);
                }
            } catch (error) {
                // Silent fail for cache loading
            }
        };
        loadCachedData();
    }, []);

    // Fetch notifications from API
    const fetchNotifications = useCallback(async (forceRefresh = false) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) return;
        
        // Skip if data was fetched recently (unless forced)
        const now = Date.now();
        if (!forceRefresh && lastFetchRef.current > 0 && (now - lastFetchRef.current) < CACHE_DURATION) {
            setLoading(false);
            return;
        }
        
        try {
            isFetchingRef.current = true;
            // Only show loading if we have no data yet
            if (allNotifs.length === 0) setLoading(true);
            
            const userData = await AsyncStorage.getItem('user');
            if (!userData) {
                navigation.navigate('Signin');
                return;
            }

            const token = await AsyncStorage.getItem('token');
            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            tokenRef.current = token;
            apiUrlRef.current = apiUrl;

            const response = await fetch(`${apiUrl}/user/notifications`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });

            if (response.status === 401) {
                await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiresAt']);
                navigation.navigate('Signin');
                return;
            }

            const data = await response.json();
            
            // Handle paginated response: { notifications: { data: [...] }, unread_count }
            let notificationsArray: ApiNotification[] = [];
            if (data.notifications?.data && Array.isArray(data.notifications.data)) {
                notificationsArray = data.notifications.data;
            } else if (data.data && Array.isArray(data.data)) {
                notificationsArray = data.data;
            } else if (Array.isArray(data)) {
                notificationsArray = data;
            }
            
            const notifs = notificationsArray.map((n: ApiNotification) => mapApiNotification(n));
            setAllNotifs(notifs);
            
            // Update last fetch timestamp and cache
            lastFetchRef.current = Date.now();
            await AsyncStorage.setItem(CACHE_KEYS.NOTIFICATIONS_DATA, JSON.stringify(notifs));
        } catch (error) {
            // Silent fail for fetch errors
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [navigation, allNotifs.length]);

    // Refetch notifications when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [fetchNotifications])
    );

    // Toast animation
    useEffect(() => {
        if (toast) {
            Animated.sequence([
                Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.delay(2000),
                Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => setToast(null));
        }
    }, [toast]);

    const showToast = (msg: string) => {
        setToast(msg);
    };

    const markRead = async (id: string) => {
        // Optimistically update UI
        setAllNotifs(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
        
        // Call API to mark as read
        try {
            await fetch(`${apiUrlRef.current}/user/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokenRef.current}`,
                    Accept: 'application/json',
                },
            });
        } catch (error) {
            // Silent fail for marking as read
        }
    };

    const openNotificationDetail = (id: string) => {
        // Mark as read optimistically
        setAllNotifs(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
        // Navigate to detail screen
        navigation.navigate('NotificationDetail', { notification_id: id });
    };

    const markAllRead = async () => {
        // Optimistically update UI
        setAllNotifs(prev => prev.map(n => ({ ...n, read: true })));
        showToast('All notifications marked as read');
        
        // Call API to mark all as read
        try {
            await fetch(`${apiUrlRef.current}/user/notifications/mark-all-read`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${tokenRef.current}`,
                    Accept: 'application/json',
                },
            });
            // Refresh notifications from server to ensure sync
            lastFetchRef.current = 0; // Reset cache timer to force refresh
            await fetchNotifications(true);
        } catch (error) {
            // Refresh to revert optimistic update on error
            lastFetchRef.current = 0;
            await fetchNotifications(true);
        }
    };

    const handleAction = (notif: Notification) => {
        markRead(notif.id);
        if (notif.groupId) {
            navigation.navigate('GroupDetails', { groupId: notif.groupId });
        }
    };

    const filtered =
        filter === 'all'
            ? allNotifs
            : filter === 'unread'
            ? allNotifs.filter(n => !n.read)
            : allNotifs.filter(n => n.type === filter);

    const unreadCount = allNotifs.filter(n => !n.read).length;

    // Pull to refresh handler
    const onRefresh = useCallback(async () => {
        await fetchNotifications(true);
    }, [fetchNotifications]);

    // Group by date label
    const grouped = filtered.reduce((acc: { [key: string]: Notification[] }, n) => {
        const d = new Date(n.time);
        const now = new Date();
        let label: string;
        if (d.toDateString() === now.toDateString()) {
            label = 'Today';
        } else {
            const y = new Date(now);
            y.setDate(now.getDate() - 1);
            label =
                d.toDateString() === y.toDateString()
                    ? 'Yesterday'
                    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
        }
        if (!acc[label]) acc[label] = [];
        acc[label].push(n);
        return acc;
    }, {});

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={D.gradientHeader[0]} />

            {/* Header */}
            <LinearGradient colors={D.gradientHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
                <View style={styles.headerDecor1} />
                <View style={styles.headerDecor2} />

                <View style={styles.headerTop}>
                    <View>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Notifications</Text>
                        <Text style={styles.headerSubtitle}>
                            {unreadCount > 0
                                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                                : "You're all caught up ✓"}
                        </Text>
                    </View>

                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllRead} style={styles.markAllButton}>
                            <Text style={styles.markAllText}>Mark all read</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <ScrollView 
                style={styles.scrollView} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={onRefresh}
                        tintColor={D.accent}
                        colors={[D.accent]}
                    />
                }
            >
                {/* Stats Bar */}
                <View style={styles.section}>
                    <StatBar notifs={allNotifs} />
                </View>

                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                >
                    {FILTERS.map(f => {
                        const count =
                            f.key === 'all'
                                ? allNotifs.length
                                : f.key === 'unread'
                                ? allNotifs.filter(n => !n.read).length
                                : allNotifs.filter(n => n.type === f.key).length;
                        const active = filter === f.key;

                        return (
                            <TouchableOpacity
                                key={f.key}
                                onPress={() => setFilter(f.key)}
                                activeOpacity={0.8}
                            >
                                {active ? (
                                    <LinearGradient
                                        colors={D.gradientAccent}
                                        style={styles.filterButton}
                                    >
                                        <Text style={[styles.filterText, { color: '#fff' }]}>{f.label}</Text>
                                        {count > 0 && (
                                            <View style={[styles.filterBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                                <Text style={[styles.filterBadgeText, { color: '#fff' }]}>{count}</Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.filterButton, styles.filterButtonInactive]}>
                                        <Text style={[styles.filterText, { color: D.textSub }]}>{f.label}</Text>
                                        {count > 0 && (
                                            <View style={[styles.filterBadge, { backgroundColor: D.accentSoft }]}>
                                                <Text style={[styles.filterBadgeText, { color: D.accent }]}>{count}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Notification List */}
                <View style={styles.listContainer}>
                    {loading && allNotifs.length === 0 ? (
                        <View style={styles.loadingState}>
                            <ActivityIndicator size="large" color={D.accent} />
                            <Text style={styles.loadingText}>Loading notifications...</Text>
                        </View>
                    ) : Object.keys(grouped).length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>🔕</Text>
                            <Text style={styles.emptyTitle}>Nothing here</Text>
                            <Text style={styles.emptySubtitle}>No notifications in this category</Text>
                        </View>
                    ) : (
                        Object.entries(grouped).map(([dateLabel, notifs]) => (
                            <View key={dateLabel}>
                                {/* Date group header */}
                                <View style={styles.dateHeader}>
                                    <Text style={styles.dateLabel}>{dateLabel}</Text>
                                    <View style={styles.dateLine} />
                                </View>

                                {notifs.map(n => (
                                    <NotifCard key={n.id} notif={n} onRead={openNotificationDetail} onAction={handleAction} />
                                ))}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Toast */}
            {toast && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            opacity: toastAnim,
                            transform: [
                                {
                                    translateX: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [100, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.toastCheck}>✓</Text>
                    <Text style={styles.toastText}>{toast}</Text>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: D.bg,
    },
    header: {
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 30,
        position: 'relative',
        overflow: 'hidden',
    },
    headerDecor1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    headerDecor2: {
        position: 'absolute',
        bottom: -40,
        left: -20,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.65)',
    },
    markAllButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 34,
    },
    markAllText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    filterScroll: {
        flexGrow: 0,
    },
    filterContent: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 8,
        flexDirection: 'row',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
    },
    filterButtonInactive: {
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '700',
    },
    filterBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
    },
    filterBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 20,
        marginBottom: 12,
    },
    dateLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: D.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: D.border,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: D.textSub,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 13,
        color: D.textMuted,
    },
    loadingState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 14,
        color: D.textSub,
        marginTop: 12,
    },
    toast: {
        position: 'absolute',
        bottom: 28,
        right: 20,
        backgroundColor: D.surfaceHi,
        borderWidth: 1,
        borderColor: D.borderHi,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    toastCheck: {
        color: D.accent2,
        fontSize: 14,
    },
    toastText: {
        color: D.text,
        fontSize: 13,
        fontWeight: '600',
    },
});

export default NotificationsScreen;
