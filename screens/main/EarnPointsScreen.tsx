import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import axios from "axios";
import Constants from "expo-constants";
import { D } from "../../theme/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
    Dashboard: undefined;
    EarnPoints: undefined;
    Referral: undefined;
    Profile: undefined;
    CreateGroup: undefined;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** One entry in catalogue.daily_actions / community_actions / profile_trust */
interface CatalogueAction {
    action: string;
    label: string;
    description: string;
    points: number;
}

interface StreakCatalogueItem {
    action: string;
    label: string;
    description: string;
    points: number;
    threshold: number;
}

interface RedemptionItem {
    action: string;
    label: string;
    description: string;
    cost: number;
}

interface NextRedemption {
    action: string;
    label: string;
    cost: number;
    progress: number;
    remaining: number;
}

interface ActivityItem {
    id: string;
    action: string;
    points: number;
    description: string;
    created_at: string;
}

interface Catalogue {
    daily_actions: CatalogueAction[];
    streak: StreakCatalogueItem[];
    community_actions: CatalogueAction[];
    profile_trust: CatalogueAction[];
    redemptions: RedemptionItem[];
}

interface PointsData {
    points: number;
    login_streak: number;
    extra_group_slots: number;
    next_redemption: NextRedemption;
    catalogue: Catalogue;
    activity: ActivityItem[];
}

interface PointsApiResponse {
    status: string;
    data: PointsData;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Maps API action IDs → display metadata (icon, colour, optional deep-link). */
const ACTION_META: Record<
    string,
    {
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
        colorSoft: string;
        navigateTo?: keyof RootStackParamList;
    }
> = {
    daily_login: {
        icon: "person-outline",
        color: D.accent as string,
        colorSoft: D.accentSoft as string,
    },
    pay_on_time: {
        icon: "card-outline",
        color: D.accent2 as string,
        colorSoft: D.accent2Soft as string,
    },
    pay_early: {
        icon: "time-outline",
        color: D.accent2 as string,
        colorSoft: D.accent2Soft as string,
    },
    referral: {
        icon: "people-outline",
        color: D.accent as string,
        colorSoft: D.accentSoft as string,
        navigateTo: "Referral",
    },
    invite_accepted: {
        icon: "person-add-outline",
        color: D.purple as string,
        colorSoft: D.purpleSoft as string,
        navigateTo: "CreateGroup",
    },
    cycle_completed: {
        icon: "star-outline",
        color: D.warn as string,
        colorSoft: D.warnSoft as string,
    },
    profile_completed: {
        icon: "person-circle-outline",
        color: D.purple as string,
        colorSoft: D.purpleSoft as string,
        navigateTo: "Profile",
    },
    identity_verified: {
        icon: "shield-checkmark-outline",
        color: D.accent2 as string,
        colorSoft: D.accent2Soft as string,
    },
    trust_review: {
        icon: "chatbubble-outline",
        color: D.textSub as string,
        colorSoft: "rgba(255,255,255,0.08)",
    },
};

/** Fallback metadata for any unknown action ID. */
const META_FALLBACK = {
    icon: "ellipse-outline" as keyof typeof Ionicons.glyphMap,
    color: D.accent as string,
    colorSoft: D.accentSoft as string,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "1 week ago";
    return `${Math.floor(days / 7)} weeks ago`;
}

/** Returns true if the ISO timestamp is from today (local time). */
function isToday(iso: string): boolean {
    const d = new Date(iso);
    const n = new Date();
    return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SecLabel: React.FC<{ text: string }> = ({ text }) => (
    <Text style={styles.secLabel}>{text}</Text>
);

interface ActionRowProps {
    action: CatalogueAction;
    meta: typeof META_FALLBACK;
    claimed: boolean;
    onPress: () => void;
    last: boolean;
}

const ActionRow: React.FC<ActionRowProps> = ({
    action,
    meta,
    claimed,
    onPress,
    last,
}) => (
    <>
        <TouchableOpacity
            style={styles.actionRow}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.actionIcon, { backgroundColor: meta.colorSoft }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
            </View>
            <View style={styles.actionTextWrap}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionSub}>{action.description}</Text>
            </View>
            <View
                style={[
                    styles.actionBadge,
                    {
                        backgroundColor: claimed
                            ? "rgba(255,255,255,0.08)"
                            : meta.colorSoft,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.actionBadgeText,
                        { color: claimed ? (D.textMuted as string) : meta.color },
                    ]}
                >
                    {claimed ? "Claimed" : `+${action.points} pts`}
                </Text>
            </View>
            <Ionicons
                name="chevron-forward"
                size={14}
                color={D.textMuted as string}
            />
        </TouchableOpacity>
        {!last && <View style={styles.rowDivider} />}
    </>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EarnPointsScreen() {
    const navigation = useNavigation<Nav>();
    const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) ?? "";

    const [pointsData, setPointsData] = useState<PointsData | null>(null);
    const [claimed, setClaimed] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("token");
            const { data: res } = await axios.get<PointsApiResponse>(
                `${apiUrl}/user/points`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                },
            );
            setPointsData(res.data);

            // Derive claimed state: an action is "claimed today" if it appears
            // in today's activity (server already awarded the points).
            const claimedToday: Record<string, boolean> = {};
            for (const item of res.data.activity) {
                if (isToday(item.created_at)) {
                    claimedToday[item.action] = true;
                }
            }
            setClaimed(claimedToday);
        } catch {
            Toast.show({ type: "error", text1: "Could not load points data" });
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData]),
    );

    const handleAction = useCallback(
        (action: CatalogueAction) => {
            const meta = ACTION_META[action.action];
            if (meta?.navigateTo) {
                navigation.navigate(meta.navigateTo as any);
            }
            // Automatic actions (login, pay_on_time, etc.) are server-side — no manual claim.
        },
        [navigation],
    );

    const handleRedeem = useCallback(
        async (item: RedemptionItem) => {
            const balance = pointsData?.points ?? 0;
            if (balance < item.cost || redeeming) return;

            setRedeeming(item.action);
            try {
                const token = await AsyncStorage.getItem("token");
                await axios.post(
                    `${apiUrl}/user/points/redeem`,
                    { action: item.action },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                    },
                );
                Toast.show({
                    type: "success",
                    text1: `${item.label} unlocked!`,
                    text2: `${item.cost} pts redeemed`,
                });
                await loadData(); // refresh balance + activity
            } catch (err: any) {
                const msg: string =
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    "Redemption failed";
                Toast.show({ type: "error", text1: msg });
            } finally {
                setRedeeming(null);
            }
        },
        [pointsData, redeeming, apiUrl, loadData],
    );

    const renderGroup = (actions: CatalogueAction[]) => (
        <View style={styles.actionGroup}>
            {actions.map((a, i) => {
                const meta = ACTION_META[a.action] ?? META_FALLBACK;
                return (
                    <ActionRow
                        key={a.action}
                        action={a}
                        meta={meta}
                        claimed={claimed[a.action] ?? false}
                        onPress={() => handleAction(a)}
                        last={i === actions.length - 1}
                    />
                );
            })}
        </View>
    );

    const balance = pointsData?.points ?? 0;
    const streak = pointsData?.login_streak ?? 0;
    const nr = pointsData?.next_redemption;
    const target = nr?.cost ?? 300;
    const progress = nr?.progress ?? balance;
    const pct = Math.min(Math.round((progress / target) * 100), 100);
    const reached = progress >= target;

    return (
        <SafeAreaView style={styles.root} edges={["bottom"]}>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent
            />

            {/* ── Header ── */}
            <LinearGradient colors={["#1a1c3a", "#2a1850"]} style={styles.header}>
                <View style={{ paddingTop: (StatusBar.currentHeight ?? 44) + 8 }}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={18} color={D.text as string} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>

                    <View style={styles.headerTitle}>
                        <View style={styles.headerIcon}>
                            <Ionicons name="star" size={20} color={D.warn as string} />
                        </View>
                        <View>
                            <Text style={styles.headerLabel}>Earn points</Text>
                            <Text style={styles.headerSub}>
                                Complete actions to grow your balance
                            </Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={D.accent as string} size="large" />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Balance Card ── */}
                    <View style={styles.card}>
                        <View style={styles.balanceRow}>
                            <View>
                                <Text style={styles.balancePts}>
                                    {balance}
                                    <Text style={styles.balancePtsUnit}> pts</Text>
                                </Text>
                                <Text style={styles.balanceSub}>Current balance</Text>
                            </View>
                            <View style={styles.balanceRight}>
                                <View
                                    style={[
                                        styles.needBadge,
                                        { backgroundColor: reached ? D.accent2Soft : D.warnSoft },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.needBadgeText,
                                            {
                                                color: reached
                                                    ? (D.accent2 as string)
                                                    : (D.warn as string),
                                            },
                                        ]}
                                    >
                                        {reached
                                            ? "Ready to unlock!"
                                            : `Need ${nr?.remaining ?? target - progress} more pts`}
                                    </Text>
                                </View>
                                <Text style={styles.needSub}>
                                    to unlock {nr?.label ?? "1 extra group"}
                                </Text>
                            </View>
                        </View>

                        {/* Progress bar */}
                        <View style={styles.progressTrack}>
                            <LinearGradient
                                colors={reached ? D.gradientSuccess : D.gradientAccent}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.progressFill, { width: `${pct}%` }]}
                            />
                        </View>
                        <View style={styles.progressLabels}>
                            <Text style={styles.progressLabelText}>0</Text>
                            <Text
                                style={[
                                    styles.progressLabelText,
                                    {
                                        color: reached
                                            ? (D.accent2 as string)
                                            : (D.accent as string),
                                        fontWeight: "700",
                                    },
                                ]}
                            >
                                {progress} / {target} pts
                            </Text>
                            <Text style={styles.progressLabelText}>{target}</Text>
                        </View>
                    </View>

                    {/* ── Daily Actions ── */}
                    {(pointsData?.catalogue.daily_actions.length ?? 0) > 0 && (
                        <>
                            <SecLabel text="Daily Actions" />
                            {renderGroup(pointsData!.catalogue.daily_actions)}
                        </>
                    )}

                    {/* ── Weekly Login Streak ── */}
                    {(pointsData?.catalogue.streak.length ?? 0) > 0 &&
                        (() => {
                            const streakItem = pointsData!.catalogue.streak[0];
                            const daysLeft = Math.max(streakItem.threshold - streak, 0);
                            return (
                                <>
                                    <SecLabel text="Weekly Login Streak" />
                                    <View style={styles.card}>
                                        <View style={styles.streakHeader}>
                                            <View>
                                                <Text style={styles.streakTitle}>
                                                    {streak}-day streak
                                                </Text>
                                                <Text style={styles.streakSub}>
                                                    {daysLeft > 0
                                                        ? `${daysLeft} more days = ${streakItem.points} bonus pts`
                                                        : "Bonus earned this week!"}
                                                </Text>
                                            </View>
                                            <View style={styles.streakBonusBadge}>
                                                <Text style={styles.streakBonusText}>
                                                    +{streakItem.points} pts bonus
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.streakDaysRow}>
                                            {(() => {
                                                // todayIndex: 0=Mon … 6=Sun
                                                const todayIndex = (new Date().getDay() + 6) % 7;
                                                const clampedStreak = Math.min(streak, todayIndex + 1);
                                                return DAY_LABELS.map((label, i) => {
                                                    const isFuture = i > todayIndex;
                                                    const isToday  = i === todayIndex;
                                                    const done     = !isFuture && !isToday && i >= todayIndex - clampedStreak + 1;
                                                    const missed   = !isFuture && !isToday && !done;
                                                    return (
                                                        <View
                                                            key={i}
                                                            style={[
                                                                styles.streakDay,
                                                                done   && styles.streakDayDone,
                                                                isToday && styles.streakDayToday,
                                                                missed && styles.streakDayMissed,
                                                            ]}
                                                        >
                                                            {done && (
                                                                <Ionicons
                                                                    name="checkmark"
                                                                    size={10}
                                                                    color={D.accent2 as string}
                                                                />
                                                            )}
                                                            {missed && (
                                                                <Ionicons
                                                                    name="close"
                                                                    size={10}
                                                                    color={D.danger as string}
                                                                />
                                                            )}
                                                            <Text
                                                                style={[
                                                                    styles.streakDayLabel,
                                                                    done   && { color: D.accent2 as string },
                                                                    isToday && { color: D.accent2 as string },
                                                                    missed && { color: D.danger as string },
                                                                ]}
                                                            >
                                                                {label}
                                                            </Text>
                                                            {isToday && (
                                                                <Text style={styles.streakDayNow}>now</Text>
                                                            )}
                                                        </View>
                                                    );
                                                });
                                            })()}
                                        </View>
                                    </View>
                                </>
                            );
                        })()}

                    {/* ── Community Actions ── */}
                    {(pointsData?.catalogue.community_actions.length ?? 0) > 0 && (
                        <>
                            <SecLabel text="Community Actions" />
                            {renderGroup(pointsData!.catalogue.community_actions)}
                        </>
                    )}

                    {/* ── Profile & Trust ── */}
                    {(pointsData?.catalogue.profile_trust.length ?? 0) > 0 && (
                        <>
                            <SecLabel text="Profile & Trust" />
                            {renderGroup(pointsData!.catalogue.profile_trust)}
                        </>
                    )}

                    {/* ── Redeem ── */}
                    {(pointsData?.catalogue.redemptions.length ?? 0) > 0 && (
                        <>
                            <SecLabel text="Redeem Points" />
                            <View style={styles.actionGroup}>
                                {pointsData!.catalogue.redemptions.map((item, i) => {
                                    const canAfford = (pointsData?.points ?? 0) >= item.cost;
                                    const isRedeeming = redeeming === item.action;
                                    return (
                                        <React.Fragment key={item.action}>
                                            <TouchableOpacity
                                                style={styles.actionRow}
                                                onPress={() => handleRedeem(item)}
                                                activeOpacity={canAfford ? 0.7 : 1}
                                                disabled={!!redeeming}
                                            >
                                                <View
                                                    style={[
                                                        styles.actionIcon,
                                                        { backgroundColor: canAfford ? D.accent2Soft as string : "rgba(255,255,255,0.06)" },
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name="gift-outline"
                                                        size={18}
                                                        color={canAfford ? D.accent2 as string : D.textMuted as string}
                                                    />
                                                </View>
                                                <View style={styles.actionTextWrap}>
                                                    <Text style={styles.actionLabel}>{item.label}</Text>
                                                    <Text style={styles.actionSub}>{item.description}</Text>
                                                </View>
                                                {isRedeeming ? (
                                                    <ActivityIndicator
                                                        size="small"
                                                        color={D.accent2 as string}
                                                        style={{ marginRight: 8 }}
                                                    />
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.redeemBtn,
                                                            !canAfford && styles.redeemBtnDisabled,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.redeemBtnText,
                                                                !canAfford && styles.redeemBtnTextDisabled,
                                                            ]}
                                                        >
                                                            {item.cost} pts
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                            {i < pointsData!.catalogue.redemptions.length - 1 && (
                                                <View style={styles.rowDivider} />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/* ── Recent Activity ── */}
                    {(pointsData?.activity.length ?? 0) > 0 && (
                        <>
                            <SecLabel text="Recent Activity" />
                            <View style={[styles.actionGroup, { marginBottom: 4 }]}>
                                {pointsData!.activity.map((item, i) => (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.historyRow,
                                            i < pointsData!.activity.length - 1 &&
                                            styles.historyRowDivider,
                                        ]}
                                    >
                                        <View style={{ flex: 1, marginRight: 12 }}>
                                            <Text style={styles.historyLabel}>
                                                {item.description}
                                            </Text>
                                            <Text style={styles.historySub}>
                                                {relativeTime(item.created_at)}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.historyPts,
                                                {
                                                    color:
                                                        item.points >= 0
                                                            ? (D.accent2 as string)
                                                            : (D.danger as string),
                                                },
                                            ]}
                                        >
                                            {item.points > 0
                                                ? `+${item.points}`
                                                : String(item.points)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_BG = "rgba(0,20,60,0.90)";

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: D.bg as string,
    },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.20)",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginBottom: 16,
        gap: 6,
    },
    backText: {
        color: D.text as string,
        fontSize: 13,
        fontWeight: "700",
    },
    headerTitle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: D.warnSoft as string,
        borderWidth: 1,
        borderColor: "rgba(255,169,77,0.30)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerLabel: {
        fontSize: 18,
        fontWeight: "800",
        color: D.text as string,
        letterSpacing: -0.4,
    },
    headerSub: {
        fontSize: 12,
        color: D.textMuted as string,
        marginTop: 2,
    },

    loadingWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },

    // Cards
    card: {
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: D.border as string,
        borderRadius: 18,
        padding: 18,
        marginBottom: 12,
    },

    // Balance
    balanceRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    balancePts: {
        fontSize: 34,
        fontWeight: "800",
        color: D.text as string,
        lineHeight: 40,
    },
    balancePtsUnit: {
        fontSize: 14,
        color: D.textMuted as string,
        fontWeight: "400",
    },
    balanceSub: {
        fontSize: 12,
        color: D.textMuted as string,
        marginTop: 4,
    },
    balanceRight: {
        alignItems: "flex-end",
        gap: 5,
    },
    needBadge: {
        paddingHorizontal: 11,
        paddingVertical: 4,
        borderRadius: 20,
    },
    needBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    needSub: {
        fontSize: 11,
        color: D.textMuted as string,
    },

    // Progress
    progressTrack: {
        height: 6,
        backgroundColor: D.border as string,
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 5,
    },
    progressFill: {
        height: "100%",
        borderRadius: 3,
    },
    progressLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    progressLabelText: {
        fontSize: 11,
        color: D.textMuted as string,
    },

    // Section label
    secLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: D.textMuted as string,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 10,
        marginTop: 4,
    },

    // Action groups
    actionGroup: {
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: D.border as string,
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 16,
    },
    actionIcon: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    actionTextWrap: {
        flex: 1,
    },
    actionLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: D.text as string,
        marginBottom: 2,
    },
    actionSub: {
        fontSize: 11,
        color: D.textMuted as string,
    },
    actionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        flexShrink: 0,
    },
    actionBadgeText: {
        fontSize: 12,
        fontWeight: "700",
    },
    rowDivider: {
        height: 1,
        backgroundColor: D.border as string,
        marginHorizontal: 16,
    },

    // Redeem button
    redeemBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: D.accent2Soft as string,
        borderWidth: 1,
        borderColor: "rgba(0,200,150,0.35)",
        flexShrink: 0,
    },
    redeemBtnDisabled: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderColor: D.border as string,
    },
    redeemBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: D.accent2 as string,
    },
    redeemBtnTextDisabled: {
        color: D.textMuted as string,
    },

    // Streak
    streakHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    streakTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: D.text as string,
    },
    streakSub: {
        fontSize: 11,
        color: D.textMuted as string,
        marginTop: 2,
    },
    streakBonusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        backgroundColor: D.warnSoft as string,
        borderWidth: 1,
        borderColor: "rgba(255,169,77,0.30)",
    },
    streakBonusText: {
        fontSize: 10,
        fontWeight: "700",
        color: D.warn as string,
    },
    streakDaysRow: {
        flexDirection: "row",
        gap: 6,
    },
    streakDay: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: D.border as string,
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
    },
    streakDayDone: {
        backgroundColor: D.accent2Soft as string,
        borderColor: "rgba(0,200,150,0.40)",
    },
    streakDayMissed: {
        backgroundColor: D.dangerSoft as string,
        borderColor: "rgba(255,107,107,0.35)",
    },
    streakDayToday: {
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: D.accent2 as string,
    },
    streakDayLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: D.textMuted as string,
    },
    streakDayNow: {
        fontSize: 8,
        color: D.accent2 as string,
        lineHeight: 10,
    },

    // History
    historyRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    historyRowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: D.border as string,
    },
    historyLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: D.text as string,
    },
    historySub: {
        fontSize: 11,
        color: D.textMuted as string,
    },
    historyPts: {
        fontSize: 14,
        fontWeight: "700",
    },
});
