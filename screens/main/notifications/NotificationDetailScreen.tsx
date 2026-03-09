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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────
type RootStackParamList = {
    NotificationDetail: { notification_id: string };
    Signin: undefined;
    GroupDetails: { group_id: number };
};

interface NotificationData {
    type?: string;
    title?: string;
    message?: string;
    group_id?: number;
    group_title?: string;
    group_name?: string;
    user_id?: number;
    user_name?: string;
    amount?: string;
    join_request_id?: number;
    // Login notification specific fields
    ip_address?: string;
    user_agent?: string;
    device?: string;
    login_time?: string;
    is_new_device?: boolean;
    [key: string]: any;
}

interface ApiNotification {
    id: string;
    type: string;
    notifiable_type: string;
    notifiable_id: number;
    data: NotificationData;
    read_at: string | null;
    created_at: string;
    updated_at: string;
}

// Related data interfaces
interface RelatedGroup {
    id: number;
    owner_id: number;
    title: string;
    total_users: number;
    target_amount: string;
    payable_amount: string;
    expected_start_date: string;
    expected_end_date: string;
    payment_out_day: number;
    status: string;
    created_at: string;
    updated_at: string;
}

interface RelatedUser {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    status: string;
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
}

interface RelatedData {
    group?: RelatedGroup;
    user?: RelatedUser;
}

interface NotificationDetailResponse {
    status: string;
    data: {
        notification: ApiNotification;
        related: RelatedData | any[];
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDateTime = (iso: string) => {
    return `${formatDate(iso)} at ${formatTime(iso)}`;
};

const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(amount));
};

const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getInitials = (name?: string) =>
    (name || '?')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

// ── Notification Type Config ──────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG: { [key: string]: { icon: string; color: string; colorSoft: string; cta: string; ctaSecondary?: string } } = {
    login: { icon: '🔐', color: D.accent, colorSoft: D.accentSoft, cta: 'Secure Account', ctaSecondary: 'Dismiss' },
    group_created: { icon: '🏦', color: D.accent, colorSoft: D.accentSoft, cta: 'View Group', ctaSecondary: 'Manage Group' },
    group_joined: { icon: '🏦', color: D.accent, colorSoft: D.accentSoft, cta: 'View Group', ctaSecondary: 'View Members' },
    group_join_request: { icon: '👋', color: D.accent2, colorSoft: D.accent2Soft, cta: 'Accept Request', ctaSecondary: 'Decline Request' },
    member_joined: { icon: '✅', color: D.accent2, colorSoft: D.accent2Soft, cta: 'View Group', ctaSecondary: 'View Member' },
    member_pending: { icon: '⏳', color: D.warn, colorSoft: D.warnSoft, cta: 'Send Reminder', ctaSecondary: 'Remove Member' },
    invitation_pending: { icon: '⏳', color: D.warn, colorSoft: D.warnSoft, cta: 'Accept Invitation', ctaSecondary: 'Decline' },
    invitation_accepted: { icon: '✅', color: D.accent2, colorSoft: D.accent2Soft, cta: 'View Group' },
    invitation_declined: { icon: '❌', color: D.danger, colorSoft: D.dangerSoft, cta: 'View Group' },
    group_starting: { icon: '🚀', color: D.purple, colorSoft: D.purpleSoft, cta: 'View Schedule', ctaSecondary: 'Set Reminder' },
    payment_due: { icon: '💳', color: D.danger, colorSoft: D.dangerSoft, cta: 'Pay Now', ctaSecondary: 'View History' },
    payment_received: { icon: '💰', color: D.accent2, colorSoft: D.accent2Soft, cta: 'View Details' },
    payment_reminder: { icon: '⏰', color: D.warn, colorSoft: D.warnSoft, cta: 'Pay Now', ctaSecondary: 'Snooze' },
    payout_received: { icon: '🎉', color: D.accent2, colorSoft: D.accent2Soft, cta: 'View Details' },
    default: { icon: '🔔', color: D.accent, colorSoft: D.accentSoft, cta: 'Dismiss' },
};

// ── Extract notification type from Laravel class name or data ─────────────────
function extractNotificationType(apiNotif: ApiNotification): string {
    if (apiNotif.data?.type) {
        return apiNotif.data.type;
    }
    
    if (apiNotif.type) {
        const className = apiNotif.type.split('\\').pop() || '';
        const withoutSuffix = className.replace(/Notification$/, '');
        const snakeCase = withoutSuffix
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
        return snakeCase;
    }
    
    return 'default';
}

// ── Get notification title ────────────────────────────────────────────────────
function getNotificationTitle(apiNotif: ApiNotification, notifType: string): string {
    if (apiNotif.data?.title) {
        return apiNotif.data.title;
    }
    
    // Generate title based on type
    const titles: { [key: string]: string } = {
        login: 'New Login Detected',
        group_created: 'Group Created Successfully',
        group_joined: 'You Joined a Group',
        group_join_request: 'New Join Request',
        member_joined: 'Member Joined Group',
        member_pending: 'Member Invitation Pending',
        invitation_pending: 'Invitation Pending',
        invitation_accepted: 'Invitation Accepted',
        invitation_declined: 'Invitation Declined',
        group_starting: 'Group Starting Soon',
        payment_due: 'Payment Due',
        payment_received: 'Payment Received',
        payment_reminder: 'Payment Reminder',
        payout_received: 'Payout Received',
    };
    
    return titles[notifType] || notifType.split('_').map(w => capitalize(w)).join(' ');
}

// ── Detail Block Component ────────────────────────────────────────────────────
const DetailBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.detailBlock}>
        <Text style={styles.detailBlockTitle}>{title}</Text>
        {children}
    </View>
);

// ── Info Row Component ────────────────────────────────────────────────────────
const InfoRow: React.FC<{
    icon: string;
    label: string;
    value: string;
    valueColor?: string;
    last?: boolean;
}> = ({ icon, label, value, valueColor, last }) => (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
        <View style={styles.infoRowLeft}>
            <View style={styles.infoRowIcon}>
                <Text style={styles.infoRowIconText}>{icon}</Text>
            </View>
            <Text style={styles.infoRowLabel}>{label}</Text>
        </View>
        <Text style={[styles.infoRowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
const NotificationDetailScreen: React.FC = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'NotificationDetail'>>();
    const { notification_id } = route.params ?? { notification_id: '' };

    const [notification, setNotification] = useState<ApiNotification | null>(null);
    const [relatedData, setRelatedData] = useState<RelatedData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Fetch notification details
    const fetchNotificationDetail = useCallback(async () => {
        if (!notification_id) {
            navigation.goBack();
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                navigation.navigate('Signin');
                return;
            }

            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            const response = await fetch(`${apiUrl}/user/notifications/${notification_id}`, {
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

            if (!response.ok) {
                throw new Error('Failed to load notification');
            }

            const data: NotificationDetailResponse = await response.json();
            
            if (data.status === 'success' && data.data?.notification) {
                setNotification(data.data.notification);
                
                // Handle related data - can be object or array
                const relatedRaw = data.data.related;
                if (relatedRaw && !Array.isArray(relatedRaw)) {
                    setRelatedData(relatedRaw as RelatedData);
                } else {
                    setRelatedData({});
                }
                
                // Mark as read if not already
                if (!data.data.notification.read_at) {
                    markAsRead(token, apiUrl);
                }
                
                // Animate in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }).start();
            } else {
                throw new Error('Invalid response');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load notification');
        } finally {
            setLoading(false);
        }
    }, [notification_id, navigation, fadeAnim]);

    // Mark notification as read
    const markAsRead = async (token: string, apiUrl: string) => {
        try {
            await fetch(`${apiUrl}/user/notifications/${notification_id}/read`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
        } catch (error) {
            // Silent fail for marking as read
        }
    };

    useEffect(() => {
        fetchNotificationDetail();
    }, [fetchNotificationDetail]);

    // Handle CTA actions
    const handleAction = async (action: string) => {
        if (!notification) return;
        
        setActionLoading(action);
        
        try {
            const notifType = extractNotificationType(notification);
            const groupId = notification.data?.group_id || relatedData.group?.id;
            
            // Handle different actions based on notification type and action label
            const token = await AsyncStorage.getItem('token');
            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            const userId = notification.data?.user_id || relatedData.user?.id;
            
            switch (action) {
                case 'View Group':
                case 'Manage Group':
                case 'View Members':
                case 'View Schedule':
                    if (groupId) {
                        navigation.navigate('GroupDetails', { group_id: groupId });
                    }
                    return;
                    
                case 'Pay Now':
                case 'View History':
                case 'View Details':
                    if (groupId) {
                        navigation.navigate('GroupDetails', { group_id: groupId });
                    }
                    return;
                    
                case 'Accept Request':
                    if (groupId && token) {
                        const joinRequestId = notification.data?.join_request_id;
                        if (!joinRequestId) {
                            alert('Join request ID not found');
                            return;
                        }
                        const response = await fetch(`${apiUrl}/user/group/${groupId}/join-requests/${joinRequestId}/approve`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: 'application/json',
                            },
                        });
                        if (response.ok) {
                            alert('Request accepted successfully!');
                            navigation.goBack();
                        } else {
                            const errorData = await response.json();
                            alert(errorData.message || 'Failed to accept request');
                        }
                    }
                    return;
                    
                case 'Decline Request':
                    if (groupId && token) {
                        const joinRequestId = notification.data?.join_request_id;
                        if (!joinRequestId) {
                            alert('Join request ID not found');
                            return;
                        }
                        const response = await fetch(`${apiUrl}/user/group/${groupId}/join-requests/${joinRequestId}/reject`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: 'application/json',
                            },
                        });
                        if (response.ok) {
                            alert('Request declined');
                            navigation.goBack();
                        } else {
                            const errorData = await response.json();
                            alert(errorData.message || 'Failed to decline request');
                        }
                    }
                    return;
                    
                case 'Accept Invitation':
                    // TODO: Implement accept invitation API call
                    if (groupId) {
                        navigation.navigate('GroupDetails', { group_id: groupId });
                    }
                    return;
                    
                case 'Decline':
                    // TODO: Implement decline invitation API call
                    navigation.goBack();
                    return;
                    
                case 'Send Reminder':
                case 'Remove Member':
                    // TODO: Implement member management
                    if (groupId) {
                        navigation.navigate('GroupDetails', { group_id: groupId });
                    }
                    return;
                    
                case 'Secure Account':
                    // TODO: Navigate to security settings
                    alert('Security settings coming soon');
                    return;
                    
                case 'Set Reminder':
                case 'Snooze':
                    // TODO: Implement reminder/snooze functionality
                    alert('Reminder feature coming soon');
                    return;
                    
                case 'Dismiss':
                default:
                    navigation.goBack();
                    return;
            }
            
        } catch (error) {
            // Silent fail for action errors
        } finally {
            setTimeout(() => setActionLoading(null), 500);
        }
    };

    // Loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={D.gradientHeader[0]} />
                <LinearGradient
                    colors={D.gradientHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notification</Text>
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={D.accent} />
                    <Text style={styles.loadingText}>Loading notification...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (error || !notification) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={D.gradientHeader[0]} />
                <LinearGradient
                    colors={D.gradientHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notification</Text>
                </LinearGradient>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorTitle}>Unable to Load</Text>
                    <Text style={styles.errorMessage}>{error || 'Notification not found'}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchNotificationDetail}>
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const notifType = extractNotificationType(notification);
    const config = NOTIF_TYPE_CONFIG[notifType] || NOTIF_TYPE_CONFIG.default;
    const title = getNotificationTitle(notification, notifType);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={D.gradientHeader[0]} />
            
            <Animated.ScrollView
                style={[styles.scrollView, { opacity: fadeAnim }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <LinearGradient
                    colors={D.gradientHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.detailHeader}
                >
                    {/* Decorative circles */}
                    <View style={styles.headerDecor1} />
                    <View style={styles.headerDecor2} />

                    {/* Back button */}
                    <TouchableOpacity style={styles.backButtonPill} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={16} color="#fff" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>

                    {/* Icon */}
                    <View style={[styles.bigIcon, { backgroundColor: config.colorSoft, borderColor: config.color + '50' }]}>
                        <Text style={styles.bigIconText}>{config.icon}</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.detailTitle}>{title}</Text>

                    {/* Meta info */}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaDate}>{formatDateTime(notification.created_at)}</Text>
                        <View style={styles.metaDot} />
                        <View style={[styles.statusPill, notification.read_at ? styles.statusRead : styles.statusUnread]}>
                            <Text style={styles.statusText}>{notification.read_at ? 'READ' : 'UNREAD'}</Text>
                        </View>
                        <View style={[styles.typePill, { backgroundColor: config.colorSoft, borderColor: config.color + '30' }]}>
                            <Text style={[styles.typeText, { color: config.color }]}>
                                {notifType.replace(/_/g, ' ').toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Body Content */}
                <View style={styles.bodyContent}>
                    {/* Message */}
                    <DetailBlock title="Message">
                        <Text style={styles.messageText}>
                            {notification.data?.message || 'No message provided'}
                        </Text>
                    </DetailBlock>

                    {/* Login-specific details */}
                    {notifType === 'login' && (
                        <DetailBlock title="Login Details">
                            <InfoRow 
                                icon="📱" 
                                label="Device" 
                                value={notification.data?.device || 'Unknown Device'} 
                            />
                            <InfoRow 
                                icon="🌐" 
                                label="IP Address" 
                                value={notification.data?.ip_address || 'Unknown'} 
                            />
                            <InfoRow 
                                icon="🕐" 
                                label="Login Time" 
                                value={notification.data?.login_time || formatDateTime(notification.created_at)} 
                            />
                            <InfoRow 
                                icon="🆕" 
                                label="New Device" 
                                value={notification.data?.is_new_device ? 'Yes' : 'No'} 
                                valueColor={notification.data?.is_new_device ? D.warn : D.accent2}
                            />
                            <InfoRow 
                                icon="🖥️" 
                                label="User Agent" 
                                value={notification.data?.user_agent?.substring(0, 40) + '...' || 'Unknown'}
                                last
                            />
                        </DetailBlock>
                    )}

                    {/* Group-specific details - Rich data from related or basic from notification */}
                    {(relatedData.group || notification.data?.group_id) && (
                        <DetailBlock title="Group Details">
                            <View style={styles.groupHeader}>
                                <View style={styles.groupIconContainer}>
                                    <LinearGradient
                                        colors={D.gradientAccent}
                                        style={styles.groupIcon}
                                    >
                                        <Text style={styles.groupIconText}>🏦</Text>
                                    </LinearGradient>
                                </View>
                                <View style={styles.groupInfo}>
                                    <Text style={styles.groupName}>
                                        {relatedData.group?.title || notification.data?.group_title || notification.data?.group_name || `Group #${notification.data?.group_id}`}
                                    </Text>
                                    {relatedData.group?.status && (
                                        <View style={[
                                            styles.groupStatusPill,
                                            { backgroundColor: relatedData.group.status === 'active' ? D.accent2Soft : D.warnSoft }
                                        ]}>
                                            <Text style={[
                                                styles.groupStatusText,
                                                { color: relatedData.group.status === 'active' ? D.accent2 : D.warn }
                                            ]}>
                                                {relatedData.group.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {relatedData.group ? (
                                <>
                                    <InfoRow 
                                        icon="💷" 
                                        label="Target Amount" 
                                        value={formatCurrency(relatedData.group.target_amount)} 
                                        valueColor={D.accent}
                                    />
                                    <InfoRow 
                                        icon="💸" 
                                        label="Monthly Each" 
                                        value={formatCurrency(relatedData.group.payable_amount)} 
                                    />
                                    <InfoRow 
                                        icon="👥" 
                                        label="Total Members" 
                                        value={`${relatedData.group.total_users} people`} 
                                    />
                                    <InfoRow 
                                        icon="📅" 
                                        label="Start Date" 
                                        value={formatDate(relatedData.group.expected_start_date)} 
                                    />
                                    <InfoRow 
                                        icon="🏁" 
                                        label="End Date" 
                                        value={formatDate(relatedData.group.expected_end_date)} 
                                    />
                                    <InfoRow 
                                        icon="📆" 
                                        label="Payment Day" 
                                        value={`${ordinal(relatedData.group.payment_out_day)} of month`}
                                        last
                                    />
                                </>
                            ) : notification.data?.amount ? (
                                <InfoRow 
                                    icon="💷" 
                                    label="Amount" 
                                    value={notification.data.amount} 
                                    valueColor={D.accent}
                                    last
                                />
                            ) : null}
                        </DetailBlock>
                    )}

                    {/* User-specific details - Rich data from related or basic from notification */}
                    {(relatedData.user || notification.data?.user_name) && (
                        <DetailBlock title="User Details">
                            {relatedData.user ? (
                                <>
                                    <View style={styles.userHeader}>
                                        <View style={styles.userAvatar}>
                                            <Text style={styles.userAvatarText}>
                                                {getInitials(relatedData.user.name)}
                                            </Text>
                                        </View>
                                        <View style={styles.userInfo}>
                                            <Text style={styles.userName}>{relatedData.user.name}</Text>
                                            <Text style={styles.userEmail}>{relatedData.user.email}</Text>
                                        </View>
                                        <View style={[
                                            styles.userStatusPill,
                                            { backgroundColor: relatedData.user.status === 'active' ? D.accent2Soft : D.warnSoft }
                                        ]}>
                                            <Text style={[
                                                styles.userStatusText,
                                                { color: relatedData.user.status === 'active' ? D.accent2 : D.warn }
                                            ]}>
                                                {relatedData.user.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                    <InfoRow 
                                        icon="📞" 
                                        label="Mobile" 
                                        value={relatedData.user.mobile || 'Not provided'} 
                                    />
                                    <InfoRow 
                                        icon="✉️" 
                                        label="Email Verified" 
                                        value={relatedData.user.email_verified_at ? 'Yes ✓' : 'No ✕'}
                                        valueColor={relatedData.user.email_verified_at ? D.accent2 : D.danger}
                                    />
                                    <InfoRow 
                                        icon="📅" 
                                        label="Member Since" 
                                        value={formatDate(relatedData.user.created_at)}
                                        last
                                    />
                                </>
                            ) : (
                                <InfoRow 
                                    icon="👤" 
                                    label="Name" 
                                    value={notification.data?.user_name || 'Unknown'} 
                                    last
                                />
                            )}
                        </DetailBlock>
                    )}

                    {/* Notification Metadata */}
                    <DetailBlock title="Notification Info">
                        <InfoRow 
                            icon="🆔" 
                            label="ID" 
                            value={notification.id.substring(0, 8) + '...'} 
                        />
                        <InfoRow 
                            icon="📅" 
                            label="Created" 
                            value={relTime(notification.created_at)} 
                        />
                        {notification.read_at && (
                            <InfoRow 
                                icon="👁️" 
                                label="Read At" 
                                value={relTime(notification.read_at)} 
                            />
                        )}
                        <InfoRow 
                            icon="🔄" 
                            label="Updated" 
                            value={relTime(notification.updated_at)} 
                            last
                        />
                    </DetailBlock>

                    {/* CTA Buttons */}
                    <View style={styles.ctaContainer}>
                        <TouchableOpacity
                            style={[
                                styles.ctaPrimary,
                                { backgroundColor: config.color },
                                actionLoading === config.cta && styles.ctaDisabled,
                            ]}
                            onPress={() => handleAction(config.cta)}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === config.cta ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.ctaPrimaryText}>
                                    {config.icon} {config.cta}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {config.ctaSecondary && (
                            <TouchableOpacity
                                style={[
                                    styles.ctaSecondary,
                                    actionLoading === config.ctaSecondary && styles.ctaDisabled,
                                ]}
                                onPress={() => handleAction(config.ctaSecondary!)}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === config.ctaSecondary ? (
                                    <ActivityIndicator size="small" color={D.textSub} />
                                ) : (
                                    <Text style={styles.ctaSecondaryText}>{config.ctaSecondary}</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animated.ScrollView>
        </SafeAreaView>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: D.bg,
    },
    scrollView: {
        flex: 1,
    },
    
    // Header gradient (loading/error states)
    headerGradient: {
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginTop: 8,
    },
    
    // Loading
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        fontSize: 14,
        color: D.textSub,
        marginTop: 12,
    },
    
    // Error
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: D.text,
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        color: D.textSub,
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: D.accent,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    
    // Detail Header
    detailHeader: {
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 32,
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
    
    // Back button
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButtonPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    
    // Big icon
    bigIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    bigIconText: {
        fontSize: 28,
    },
    
    // Title & Meta
    detailTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    metaDate: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 20,
    },
    statusRead: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    statusUnread: {
        backgroundColor: D.warn,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        color: '#fff',
    },
    typePill: {
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 20,
        borderWidth: 1,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    
    // Body Content
    bodyContent: {
        padding: 16,
        paddingBottom: 32,
    },
    
    // Detail Block
    detailBlock: {
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
    },
    detailBlockTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: D.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.9,
        marginBottom: 14,
    },
    messageText: {
        fontSize: 14,
        color: D.textSub,
        lineHeight: 22,
    },
    
    // Info Row
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    infoRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
    },
    infoRowIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: D.accentSoft,
        borderWidth: 1,
        borderColor: D.accent + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoRowIconText: {
        fontSize: 13,
    },
    infoRowLabel: {
        fontSize: 13,
        color: D.textSub,
    },
    infoRowValue: {
        fontSize: 13,
        fontWeight: '700',
        color: D.text,
        flex: 1,
        textAlign: 'right',
    },
    
    // Group Header
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    groupIconContainer: {
        flexShrink: 0,
    },
    groupIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupIconText: {
        fontSize: 20,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: 16,
        fontWeight: '800',
        color: D.text,
    },
    groupStatusPill: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 20,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    groupStatusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    
    // User Header
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: D.accentSoft,
        borderWidth: 1.5,
        borderColor: D.accent + '30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatarText: {
        fontSize: 16,
        fontWeight: '800',
        color: D.accent,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: D.text,
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 12,
        color: D.textSub,
    },
    userStatusPill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
    },
    userStatusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    
    // CTA Buttons
    ctaContainer: {
        marginTop: 8,
        gap: 10,
    },
    ctaPrimary: {
        borderRadius: 14,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaPrimaryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    ctaSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaSecondaryText: {
        color: D.textSub,
        fontSize: 14,
        fontWeight: '700',
    },
    ctaDisabled: {
        opacity: 0.6,
    },
});

export default NotificationDetailScreen;
