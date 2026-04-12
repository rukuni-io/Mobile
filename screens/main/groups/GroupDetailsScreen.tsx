import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    StatusBar,
    Alert,
    TouchableOpacity,
    Dimensions,
    Animated,
    ActivityIndicator,
    Platform,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { semanticColors } from '../../../theme/semanticColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupUser {
    id?: string;
    name?: string;
    mobile?: string;
    email?: string;
    pivot: {
        role: string;
        is_active: boolean;
        payout_position?: number;
    };
}

interface GroupContribution {
    id: string;
    user_id: string;
    cycle_number: number;
    amount: string;
    status: 'pending' | 'under_review' | 'verified' | 'rejected';
    submitted_at: string;
}

interface Group {
    id: string;
    owner_id: string;
    title: string;
    target_amount: string;
    payable_amount?: string;
    total_users: number;
    active_members_count: number;
    pending_members_count?: number;
    expected_start_date?: string;
    expected_end_date?: string;
    payment_out_day?: number;
    contribution_frequency?: string;
    payment_out_weekday?: number | null;
    status?: string;
    users: Array<GroupUser>;
    contributions?: GroupContribution[];
}

interface JoinRequest {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    user_name: string;
    user_email: string;
}

interface GroupApiResponse {
    message: string;
    data: {
        group: Group;
        pending_invitees: GroupUser[];
        join_requests: JoinRequest[];
    };
}

type RootStackParamList = {
    GroupDetails: { group_id: string };
    Contribute: {
        group_id: string;
        group_title: string;
        payable_amount: number;
        cycle_number: number;
        payout_position?: number;
        payment_out_day?: number;
    };
    AdminContributions: {
        group_id: string;
        group_title: string;
        member_only?: boolean;
    };
    Signin: undefined;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capitalize = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : '';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const getInitials = (name?: string) =>
    (name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

// ─── Masking Helpers for Privacy ──────────────────────────────────────────────

const maskName = (name?: string): string => {
    if (!name) return '***';
    return name.split(' ').map(part => 
        part.length > 1 ? part[0] + '*'.repeat(part.length - 1) : part
    ).join(' ');
};

const maskMobile = (mobile?: string): string => {
    if (!mobile) return '***';
    if (mobile.length <= 4) return '***';
    return '*'.repeat(mobile.length - 4) + mobile.slice(-4);
};

const maskEmail = (email?: string): string => {
    if (!email) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length > 2 
        ? local[0] + '*'.repeat(local.length - 1) 
        : local[0] + '*';
    const domainParts = domain.split('.');
    const maskedDomain = domainParts[0].length > 2 
        ? domainParts[0][0] + '*'.repeat(domainParts[0].length - 1) 
        : domainParts[0][0] + '*';
    return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
};

// ─── Shadow Styles ────────────────────────────────────────────────────────────

const shadowStyles = Platform.select({
    ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    android: { elevation: 4 },
});

// ─── Day Helper ──────────────────────────────────────────────────────────────

const getDaysUntilPayment = (paymentDay?: number): string => {
    if (!paymentDay) return '—';
    const today = new Date();
    const d = today.getDate();
    const m = today.getMonth();
    const y = today.getFullYear();
    const target = d < paymentDay
        ? new Date(y, m, paymentDay)
        : new Date(y, m + 1, paymentDay);
    return String(Math.ceil((target.getTime() - today.getTime()) / 86400000));
};



// ─── Member Card ──────────────────────────────────────────────────────────────

const MemberCard = ({ user, payoutPosition, canViewDetails = true }: { user: GroupUser; payoutPosition?: number; canViewDetails?: boolean }) => {
    const isActive = user.pivot.is_active;
    const isAdmin = user.pivot.role?.toLowerCase() === 'admin';

    const displayName = canViewDetails ? (user.name || 'Unnamed') : maskName(user.name);
    const displayMobile = canViewDetails ? (user.mobile || 'N/A') : maskMobile(user.mobile);
    const displayEmail = canViewDetails ? (user.email || 'N/A') : maskEmail(user.email);

    return (
        <View style={[memberStyles.card, shadowStyles]}>
            {/* Online dot */}
            <View style={[
                memberStyles.onlineDot,
                { backgroundColor: isActive ? '#00d68f' : '#ef4444' },
            ]} />

            {/* Avatar */}
            <View style={memberStyles.avatar}>
                <Text style={memberStyles.avatarTxt}>
                    {getInitials(user.name)}
                </Text>
            </View>

            <Text style={memberStyles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={memberStyles.sub} numberOfLines={1}>{displayMobile}</Text>
            <Text style={memberStyles.sub} numberOfLines={1}>{displayEmail}</Text>

            <View style={memberStyles.roleBadge}>
                <Text style={memberStyles.roleTxt}>{capitalize(user.pivot.role)}</Text>
            </View>

                <View style={[
                    memberStyles.statusBadge,
                    { backgroundColor: isActive ? 'rgba(0,214,143,0.15)' : 'rgba(239,68,68,0.15)' },
                ]}>
                    <Ionicons
                        name={isActive ? 'checkmark-circle' : 'close-circle'}
                        size={11}
                        color={isActive ? '#00d68f' : '#ef4444'}
                    />
                    <Text style={[
                        memberStyles.statusTxt,
                        { color: isActive ? '#00d68f' : '#ef4444' },
                    ]}>
                        {isActive ? 'Active' : 'Inactive'}
                    </Text>
                </View>
                {payoutPosition ? (
                    <Text style={memberStyles.payoutLabel}>Slot #{payoutPosition}</Text>
                ) : null}
        </View>
    );
};

const memberStyles = StyleSheet.create({
    card: {
        width: 175,
        backgroundColor: '#242424',
        borderRadius: 16,
        padding: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        position: 'relative',
    },
    onlineDot: {
        position: 'absolute', top: 11, right: 11,
        width: 9, height: 9, borderRadius: 5,
        borderWidth: 1.5, borderColor: '#242424',
    },
    avatar: {
        width: 52, height: 52, borderRadius: 26,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    avatarTxt: {
        fontSize: 18, fontWeight: '800', color: '#ffffff',
    },
    name: {
        fontSize: 13, fontWeight: '700', color: '#ffffff',
        textAlign: 'center', marginBottom: 3, width: '100%',
    },
    sub: {
        fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
        marginBottom: 2, width: '100%',
    },
    roleBadge: {
        marginTop: 8, marginBottom: 6,
        paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    roleTxt: {
        fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    },
    statusTxt: {
        fontSize: 11, fontWeight: '600',
    },
    payoutLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 6,
    },
});

// ─── Join Request Card ────────────────────────────────────────────────────────

const JoinRequestCard = ({ 
    request, 
    onAccept, 
    onDecline,
    processingAction,
}: { 
    request: JoinRequest; 
    onAccept: (requestId: string) => void;
    onDecline: (requestId: string) => void;
    processingAction: 'accept' | 'decline' | null;
}) => {
    const requestDate = new Date(request.created_at);
    const formattedDate = requestDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const isProcessing = processingAction !== null;
    const isAccepting = processingAction === 'accept';
    const isDeclining = processingAction === 'decline';

    return (
        <View style={[joinRequestStyles.card, shadowStyles]}>
            <View style={joinRequestStyles.header}>
                <View style={joinRequestStyles.avatar}>
                    <Text style={joinRequestStyles.avatarTxt}>
                        {getInitials(request.user_name)}
                    </Text>
                </View>
                <View style={joinRequestStyles.userInfo}>
                    <Text style={joinRequestStyles.userName} numberOfLines={1}>
                        {request.user_name}
                    </Text>
                    <Text style={joinRequestStyles.userEmail} numberOfLines={1}>
                        {request.user_email}
                    </Text>
                </View>
            </View>
            
            <View style={joinRequestStyles.meta}>
                <View style={joinRequestStyles.statusBadge}>
                    <View style={joinRequestStyles.statusDot} />
                    <Text style={joinRequestStyles.statusText}>
                        {capitalize(request.status)}
                    </Text>
                </View>
                <Text style={joinRequestStyles.dateText}>{formattedDate}</Text>
            </View>
            
            <View style={joinRequestStyles.actions}>
                <TouchableOpacity 
                    style={[joinRequestStyles.declineBtn, isProcessing && joinRequestStyles.btnDisabled]}
                    onPress={() => onDecline(request.id)}
                    disabled={isProcessing}
                >
                    {isDeclining ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                        <>
                            <Ionicons name="close" size={16} color="#ef4444" />
                            <Text style={joinRequestStyles.declineBtnTxt}>Decline</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[joinRequestStyles.acceptBtn, isProcessing && joinRequestStyles.btnDisabled]}
                    onPress={() => onAccept(request.id)}
                    disabled={isProcessing}
                >
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark" size={16} color="#ffffff" />
                            <Text style={joinRequestStyles.acceptBtnTxt}>Accept</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const joinRequestStyles = StyleSheet.create({
    card: {
        backgroundColor: '#242424',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(245,158,11,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarTxt: {
        fontSize: 16,
        fontWeight: '800',
        color: 'rgba(245,158,11,1)',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245,158,11,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(245,158,11,1)',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(245,158,11,1)',
    },
    dateText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    declineBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(239,68,68,0.15)',
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.30)',
    },
    declineBtnTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ef4444',
    },
    acceptBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#00d68f',
        paddingVertical: 11,
        borderRadius: 10,
    },
    acceptBtnTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0a1a0f',
    },
    btnDisabled: {
        opacity: 0.6,
    },
});

// ─── Detail Row ───────────────────────────────────────────────────────────────

const DetailsRow = ({
    label,
    value,
    isLast = false,
    accent = false,
}: {
    label: string;
    value: string;
    isLast?: boolean;
    accent?: boolean;
}) => (
    <View style={[detailStyles.row, isLast && detailStyles.rowLast]}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, accent && detailStyles.valueAccent]}>{value}</Text>
    </View>
);

const detailStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    rowLast: { borderBottomWidth: 0 },
    label: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
    value: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
    valueAccent: { color: '#6eb5ff' },
});

// ─── Cache Config ─────────────────────────────────────────────────────────────

const CACHE_DURATION = 20 * 1000; // 20 seconds

// ─── Main Screen ──────────────────────────────────────────────────────────────

const GroupDetailsScreen = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'GroupDetails'>>();
    const { group_id } = route.params ?? { group_id: '' };

    const [group, setGroup] = React.useState<Group | null>(null);
    const [joinRequests, setJoinRequests] = React.useState<JoinRequest[]>([]);
    const [role, setRole] = React.useState<string>('');
    const [is_active, setIsActive] = React.useState<boolean>(false);
    const [isInGroup, setIsInGroup] = React.useState<boolean>(false);
    const [joining, setJoining] = React.useState<boolean>(false);
    const [myPosition, setMyPosition] = React.useState<number | null>(null);
    const [pendingInvitees, setPendingInvitees] = React.useState<GroupUser[]>([]);
    const [processingRequest, setProcessingRequest] = React.useState<{ id: string; action: 'accept' | 'decline' } | null>(null);
    const [replacePicker, setReplacePicker] = React.useState<{ requestId: string; requesterName: string } | null>(null);
    const [selectedReplaceId, setSelectedReplaceId] = React.useState<string | null>(null);
    const [approving, setApproving] = React.useState(false);
    const [loading, setLoading] = React.useState<boolean>(true);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const lastFetchRef = React.useRef<number>(0);
    const isFetchingRef = React.useRef<boolean>(false);

    // Load cached data immediately on mount
    React.useEffect(() => {
        const loadCachedData = async () => {
            try {
                const cacheKey = `cache_group_${group_id}`;
                const cachedData = await AsyncStorage.getItem(cacheKey);
                if (cachedData) {
                    const { group: cachedGroup, pendingInvitees: cachedPendingInvitees, joinRequests: cachedJoinRequests, role: cachedRole, isActive: cachedIsActive, isInGroup: cachedIsInGroup, myPosition: cachedMyPosition } = JSON.parse(cachedData);
                    setGroup(cachedGroup);
                    setPendingInvitees(cachedPendingInvitees || []);
                    setJoinRequests(cachedJoinRequests || []);
                    setRole(cachedRole);
                    setIsActive(cachedIsActive);
                    setIsInGroup(cachedIsInGroup);
                    setMyPosition(cachedMyPosition ?? null);
                    setLoading(false);
                    Animated.timing(fadeAnim, {
                        toValue: 1, duration: 350, useNativeDriver: true,
                    }).start();
                }
            } catch (error) {
                // Silent fail for cache loading
            }
        };
        if (group_id) loadCachedData();
    }, [group_id]);

    // Refetch group data when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            if (!group_id) { navigation.goBack(); return; }
            loadGroup();
        }, [group_id])
    );

    const loadGroup = async (forceRefresh = false) => {
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
            if (!group) setLoading(true);
            
            const token = await AsyncStorage.getItem('token');
            if (!token) { navigation.navigate('Signin'); return; }

            const res = await axios.get<GroupApiResponse>(
                `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                }
            );

            const g = res.data.data.group;
            const invitees = res.data.data.pending_invitees || [];
            const requests = res.data.data.join_requests || [];
            // Only show pending join requests
            const pendingRequests = requests.filter((r: JoinRequest) => r.status.toLowerCase() === 'pending');
            setGroup(g);
            setPendingInvitees(invitees);
            setJoinRequests(pendingRequests);

            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) throw new Error('User not found.');
            const me = JSON.parse(userStr);
            const pivot = g.users.find(u => u.email === me.email)?.pivot;
            
            let newRole = '';
            let newIsActive = false;
            let newIsInGroup = false;
            let newMyPosition: number | null = null;
            if (pivot) {
                newIsInGroup = true;
                newRole = pivot.role;
                newIsActive = pivot.is_active;
                newMyPosition = pivot.payout_position ?? null;
            }

            setIsInGroup(newIsInGroup);
            setRole(newRole);
            setIsActive(newIsActive);
            setMyPosition(newMyPosition);

            // Update cache
            lastFetchRef.current = Date.now();
            const cacheKey = `cache_group_${group_id}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
                group: g,
                pendingInvitees: invitees,
                joinRequests: pendingRequests,
                role: newRole,
                isActive: newIsActive,
                isInGroup: newIsInGroup,
                myPosition: newMyPosition,
            }));

            Animated.timing(fadeAnim, {
                toValue: 1, duration: 350, useNativeDriver: true,
            }).start();
        } catch (err: any) {
            const message = err?.response?.data?.message ?? err?.message ?? 'Failed to load group details.';
            // Only show error if we don't have cached data
            if (!group) {
                Alert.alert('Error', message, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    };

    const handleJoin = async () => {
        setJoining(true);
        let endpoint = '';
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) { navigation.navigate('Signin'); return; }

            // Use different endpoint based on whether user is already in group (accepting invitation) or not (requesting to join)
            endpoint = isInGroup 
                ? `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/accept-invitation`
                : `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/send-join-request`;

            await axios.get(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            Alert.alert(
                isInGroup ? '🎉 Joined!' : '📨 Request Sent!',
                isInGroup
                    ? `You have successfully joined "${group?.title}".`
                    : `Your request to join "${group?.title}" has been sent. You'll be notified when approved.`
            );
            if (isInGroup) {
                setIsActive(true);
            }
            loadGroup();
        } catch (err: any) {
            const status: number | undefined = err?.response?.status;
            let errorMessage = 'Failed to join. Please try again.';

            if (status === 401) {
                navigation.navigate('Signin');
                return;
            } else if (status === 404) {
                errorMessage = 'This group is no longer available.';
            } else if (typeof status === 'number' && status >= 500) {
                errorMessage = 'Server is temporarily unavailable. Please try again later.';
                console.error('Server error:', [err?.response?.data, status, err?.message, endpoint]);
            } else if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (!err?.response) {
                errorMessage = 'Network error. Please check your connection.';
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setJoining(false);
        }
    };

    // Handle accept join request
    const handleAcceptRequest = async (requestId: string) => {
        // Find the requester name for the modal title
        const req = joinRequests.find(r => r.id === requestId);
        setSelectedReplaceId(null);
        setReplacePicker({ requestId, requesterName: req?.user_name ?? 'this user' });
    };

    const doApprove = async (requestId: string, replaceMemberId: string) => {
        setApproving(true);
        setProcessingRequest({ id: requestId, action: 'accept' });
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) { navigation.navigate('Signin'); return; }

            await axios.put(
                `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/join-requests/${requestId}/approve`,
                { replace_member_id: replaceMemberId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Remove from list immediately
            setJoinRequests(prev => prev.filter(r => r.id !== requestId));
            setReplacePicker(null);
            Alert.alert('Success', 'Join request accepted successfully!');
            // Refresh data in background to update members list
            loadGroup(true);
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message ?? '';
            // If the request is no longer pending, remove it from the UI anyway
            if (errorMessage.toLowerCase().includes('no longer pending') || 
                errorMessage.toLowerCase().includes('already') ||
                errorMessage.toLowerCase().includes('not found')) {
                setJoinRequests(prev => prev.filter(r => r.id !== requestId));
                setReplacePicker(null);
                loadGroup(true); // Refresh to get latest state
            }
            Alert.alert('Notice', errorMessage || 'Failed to accept request. Please try again.');
        } finally {
            setProcessingRequest(null);
            setApproving(false);
        }
    };

    // Handle decline join request
    const handleDeclineRequest = async (requestId: string) => {
        Alert.alert(
            'Decline Request',
            'Are you sure you want to decline this join request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingRequest({ id: requestId, action: 'decline' });
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) { navigation.navigate('Signin'); return; }

                            await axios.put(
                                `${Constants.expoConfig?.extra?.apiUrl}/user/group/${group_id}/join-requests/${requestId}/reject`,
                                {},
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        Accept: 'application/json',
                                        'Content-Type': 'application/json',
                                    },
                                }
                            );

                            // Remove from list immediately
                            setJoinRequests(prev => prev.filter(r => r.id !== requestId));
                            Alert.alert('Declined', 'Join request has been declined.');
                            // Refresh data in background
                            loadGroup(true);
                        } catch (err: any) {
                            const errorMessage = err?.response?.data?.message ?? '';
                            // If the request is no longer pending, remove it from the UI anyway
                            if (errorMessage.toLowerCase().includes('no longer pending') || 
                                errorMessage.toLowerCase().includes('already') ||
                                errorMessage.toLowerCase().includes('not found')) {
                                setJoinRequests(prev => prev.filter(r => r.id !== requestId));
                                loadGroup(true); // Refresh to get latest state
                            }
                            Alert.alert('Notice', errorMessage || 'Failed to decline request. Please try again.');
                        } finally {
                            setProcessingRequest(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Loading state (only show full loading screen if no cached data) ──
    if (!group && loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <View style={styles.topnav}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <Text style={styles.navLabel}>Groups</Text>
                </View>
                <View style={styles.loadingCenter}>
                    <ActivityIndicator size="large" color="#00d68f" />
                    <Text style={styles.loadingText}>Loading group info…</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Edge case: loading finished but no group data (error occurred)
    if (!group) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <View style={styles.topnav}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <Text style={styles.navLabel}>Groups</Text>
                </View>
                <View style={styles.loadingCenter}>
                    <Text style={styles.loadingText}>Unable to load group</Text>
                    <TouchableOpacity
                        style={{ marginTop: 16, padding: 12, backgroundColor: '#00d68f', borderRadius: 8 }}
                        onPress={() => loadGroup(true)}
                    >
                        <Text style={{ color: '#0a1a0f', fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const targetAmount  = parseFloat(group.target_amount);
    const monthly = parseFloat(group.payable_amount ?? '0')
        || (group.total_users ? targetAmount / group.total_users : 0);
    const verifiedContribs = (group.contributions ?? []).filter(c => c.status === 'verified');
    const collected = verifiedContribs.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const pct = targetAmount > 0
        ? Math.min(100, Math.round((collected / targetAmount) * 100))
        : 0;
    const currentCycle = group.contributions && group.contributions.length > 0
        ? Math.max(...group.contributions.map(c => c.cycle_number))
        : 1;

    const adminUser = group.users.find(u => u.pivot.role?.toLowerCase() === 'admin');
    const adminDisplayName = adminUser?.name
        ? adminUser.name.split(' ').map((p, i) => i === 0 ? p : p[0] + '.').join(' ')
        : 'Admin';

    const daysLeft = getDaysUntilPayment(group.payment_out_day);
    const primaryBtnLabel = is_active ? 'Contribute' : isInGroup ? 'Accept Invitation' : 'Request to Join';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* ── Top nav ── */}
                <View style={styles.topnav}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <Text style={styles.navLabel}>Groups</Text>
                </View>

                <Animated.View style={{ opacity: fadeAnim }}>

                    {/* ── Hero ── */}
                    <View style={styles.hero}>
                        <View style={styles.heroTop}>
                            <Text style={styles.heroTitle}>{group.title}</Text>
                            <View style={[
                                styles.activePill,
                                !is_active && { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.35)' },
                            ]}>
                                <View style={[
                                    styles.activeDot,
                                    !is_active && { backgroundColor: 'rgba(245,158,11,1)' },
                                ]} />
                                <Text style={[
                                    styles.activePillTxt,
                                    !is_active && { color: 'rgba(245,158,11,1)' },
                                ]}>
                                    {is_active ? 'Active' : isInGroup ? 'Pending' : 'Not a Member'}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.heroSub}>Managed by {adminDisplayName} · Admin</Text>

                        {/* Progress numerics */}
                        <View style={styles.pctRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                <Text style={styles.pctNum}>{pct}</Text>
                                <Text style={styles.pctSym}>%</Text>
                            </View>
                            <Text style={styles.pctAmounts}>
                                {formatCurrency(collected)} of {formatCurrency(targetAmount)}
                            </Text>
                        </View>

                        {/* Progress bar */}
                        <View style={styles.progTrack}>
                            <View style={[styles.progFill, { width: `${pct}%` as any }]} />
                        </View>

                        {/* Stats chips */}
                        <View style={styles.statsRow}>
                            <View style={styles.statChip}>
                                <Text style={styles.statN}>{group.active_members_count ?? 0}</Text>
                                <Text style={styles.statL}>Members</Text>
                            </View>
                            <View style={[styles.statChip, styles.statChipMid]}>
                                <Text style={styles.statN}>{formatCurrency(monthly)}</Text>
                                <Text style={styles.statL}>Monthly</Text>
                            </View>
                            <View style={styles.statChip}>
                                <Text style={styles.statN}>{daysLeft}</Text>
                                <Text style={styles.statL}>Days left</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Group details ── */}
                    <Text style={styles.secLabel}>Group details</Text>
                    <View style={styles.detailsCard}>
                        <DetailsRow label="Target amount" value={formatCurrency(targetAmount)} />
                        {group.contribution_frequency ? (
                            <DetailsRow label="Frequency" value={capitalize(group.contribution_frequency)} />
                        ) : null}
                        {group.expected_start_date ? (
                            <DetailsRow label="Start date" value={group.expected_start_date} />
                        ) : null}
                        {group.payment_out_day != null ? (
                            <DetailsRow
                                label="Payment day"
                                value={`${group.payment_out_day}${getOrdinalSuffix(group.payment_out_day)} of each month`}
                            />
                        ) : null}
                        <DetailsRow label="Duration" value={`${group.total_users} months`} />
                        <DetailsRow
                            label="Max members"
                            value={String(group.total_users)}
                            isLast={myPosition == null}
                        />
                        {myPosition != null && (
                            <DetailsRow
                                label="Your position"
                                value={`Slot ${myPosition} of ${group.total_users}`}
                                isLast
                                accent
                            />
                        )}
                    </View>

                    {/* ── Members ── */}
                    <Text style={styles.secLabel}>
                        Members · {group.users.length + pendingInvitees.length} of {group.total_users}
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.membersScroll}
                    >
                        {group.users.length === 0 && pendingInvitees.length === 0 ? (
                            <Text style={styles.emptyTxt}>No members yet!</Text>
                        ) : (
                            [...group.users, ...pendingInvitees].map((user, i) => (
                                <MemberCard
                                    key={user.id ?? i}
                                    user={user}
                                    payoutPosition={user.pivot.payout_position}
                                    canViewDetails={isInGroup}
                                />
                            ))
                        )}
                    </ScrollView>

                    {/* ── Pending Join Requests (Admin Only) ── */}
                    {role.toLowerCase() === 'admin' && joinRequests.length > 0 && (
                        <View style={[styles.joinRequestsCard, shadowStyles]}>
                            <View style={styles.joinRequestsHeader}>
                                <Text style={styles.joinRequestsTitle}>Join Requests</Text>
                                <View style={styles.countBadge}>
                                    <Text style={styles.countTxt}>{joinRequests.length}</Text>
                                </View>
                            </View>
                            {joinRequests.map((request) => (
                                <JoinRequestCard
                                    key={request.id}
                                    request={request}
                                    onAccept={handleAcceptRequest}
                                    onDecline={handleDeclineRequest}
                                    processingAction={processingRequest?.id === request.id ? processingRequest.action : null}
                                />
                            ))}
                        </View>
                    )}

                    {/* ── Actions ── */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btnP, joining && { opacity: 0.65 }]}
                            onPress={is_active
                                ? () => navigation.navigate('Contribute', {
                                    group_id: group.id,
                                    group_title: group.title,
                                    payable_amount: parseFloat(group.payable_amount ?? '0'),
                                    cycle_number: currentCycle,
                                    payout_position: myPosition ?? undefined,
                                    payment_out_day: group.payment_out_day,
                                })
                                : handleJoin}
                            disabled={joining}
                            activeOpacity={0.85}
                        >
                            {joining
                                ? <ActivityIndicator size="small" color="#0a1a0f" />
                                : <Text style={styles.btnPTxt}>{primaryBtnLabel}</Text>
                            }
                        </TouchableOpacity>
                        {role.toLowerCase() === 'admin' && (
                            <TouchableOpacity
                                style={[styles.btnS, { borderColor: 'rgba(0,214,143,0.35)', backgroundColor: 'rgba(0,214,143,0.08)' }]}
                                onPress={() => navigation.navigate('AdminContributions', {
                                    group_id: group.id,
                                    group_title: group.title,
                                    member_only: false,
                                })}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.btnSTxt, { color: '#00d68f' }]}>Review Contributions</Text>
                            </TouchableOpacity>
                        )}
                        {is_active && role.toLowerCase() !== 'admin' && (
                            <TouchableOpacity
                                style={[styles.btnS, { borderColor: 'rgba(110,181,255,0.35)', backgroundColor: 'rgba(110,181,255,0.08)' }]}
                                onPress={() => navigation.navigate('AdminContributions', {
                                    group_id: group.id,
                                    group_title: group.title,
                                    member_only: true,
                                })}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.btnSTxt, { color: '#6eb5ff' }]}>My Contributions</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ height: 32 }} />
                </Animated.View>
            </ScrollView>

            {/* ── Replace Member Picker Modal ── */}
            <Modal
                visible={!!replacePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setReplacePicker(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Member to Replace</Text>
                        <Text style={styles.modalSub}>
                            Approving <Text style={{ color: '#6eb5ff', fontWeight: '700' }}>{replacePicker?.requesterName}</Text> will replace the selected member
                        </Text>

                        <FlatList
                            data={[
                                    ...(group?.users.filter(u => u.pivot.role?.toLowerCase() !== 'admin') ?? []),
                                    ...pendingInvitees.filter(u => u.pivot.role?.toLowerCase() !== 'admin'),
                                ]}
                            keyExtractor={item => item.id ?? item.email ?? ''}
                            style={{ maxHeight: 320, marginBottom: 16 }}
                            renderItem={({ item }) => {
                                const isSelected = selectedReplaceId === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.memberPickerRow, isSelected && styles.memberPickerRowSelected]}
                                        onPress={() => setSelectedReplaceId(item.id ?? null)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.memberPickerAvatar}>
                                            <Text style={styles.memberPickerAvatarTxt}>{getInitials(item.name)}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.memberPickerName}>{item.name || 'Unnamed'}</Text>
                                            <Text style={styles.memberPickerEmail} numberOfLines={1}>{item.email}</Text>
                                        </View>
                                        <View style={[styles.memberPickerRadio, isSelected && styles.memberPickerRadioSelected]}>
                                            {isSelected && <View style={styles.memberPickerRadioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setReplacePicker(null)}
                                disabled={approving}
                            >
                                <Text style={styles.modalCancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, (!selectedReplaceId || approving) && { opacity: 0.5 }]}
                                disabled={!selectedReplaceId || approving}
                                onPress={() => {
                                    if (replacePicker && selectedReplaceId) {
                                        doApprove(replacePicker.requestId, selectedReplaceId);
                                    }
                                }}
                            >
                                {approving
                                    ? <ActivityIndicator size="small" color="#0a1a0f" />
                                    : <Text style={styles.modalConfirmTxt}>Approve & Replace</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// ─── Helper for ordinal suffix ────────────────────────────────────────────────

const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },

    // ── Top nav ──
    topnav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: (StatusBar.currentHeight ?? 20) + 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    backBtn: {
        width: 34,
        height: 34,
        backgroundColor: '#242424',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },

    // ── Hero ──
    hero: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.3,
        lineHeight: 31,
        flex: 1,
        marginRight: 10,
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(0,214,143,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(0,214,143,0.35)',
        marginTop: 4,
        flexShrink: 0,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00d68f',
    },
    activePillTxt: {
        fontSize: 12,
        fontWeight: '600',
        color: '#00d68f',
    },
    heroSub: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 28,
        marginTop: 6,
    },
    pctRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    pctNum: {
        fontSize: 38,
        fontWeight: '700',
        color: '#ffffff',
        lineHeight: 42,
    },
    pctSym: {
        fontSize: 20,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
        marginLeft: 2,
    },
    pctAmounts: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    progTrack: {
        height: 7,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 22,
    },
    progFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#6eb5ff',
    },
    statsRow: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    statChip: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    statChipMid: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    statN: {
        fontSize: 17,
        fontWeight: '700',
        color: '#ffffff',
    },
    statL: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 3,
    },

    // ── Section label ──
    secLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 10,
        letterSpacing: 0.2,
    },

    // ── Details card ──
    detailsCard: {
        marginHorizontal: 16,
        backgroundColor: '#242424',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },

    // ── Members grid ──
    membersGrid: {
        paddingHorizontal: 16,
    },
    membersScroll: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 8,
    },

    // ── Join requests (admin) ──
    joinRequestsCard: {
        backgroundColor: '#242424',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    joinRequestsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 8,
    },
    joinRequestsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    countBadge: {
        backgroundColor: 'rgba(245,158,11,1)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    countTxt: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },

    // ── Action buttons ──
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 28,
    },
    btnP: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#00d68f',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPTxt: {
        color: '#0a1a0f',
        fontSize: 14,
        fontWeight: '700',
    },
    btnS: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#242424',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    btnSTxt: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },

    // ── Loading / error ──
    loadingCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        gap: 12,
    },
    loadingText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
    },
    emptyTxt: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 20,
    },

    // ── Replace member picker modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 6,
    },
    modalSub: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 20,
    },
    memberPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    memberPickerRowSelected: {
        borderColor: '#6eb5ff',
        backgroundColor: 'rgba(110,181,255,0.08)',
    },
    memberPickerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberPickerAvatarTxt: {
        fontSize: 14,
        fontWeight: '800',
        color: '#ffffff',
    },
    memberPickerName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 2,
    },
    memberPickerEmail: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
    },
    memberPickerRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberPickerRadioSelected: {
        borderColor: '#6eb5ff',
    },
    memberPickerRadioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#6eb5ff',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalCancelTxt: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    modalConfirmBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#00d68f',
    },
    modalConfirmTxt: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0a1a0f',
    },
});

export default GroupDetailsScreen;