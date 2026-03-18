import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { D } from "../theme/tokens";

interface Props {
    visible: boolean;
    planName: string;        // e.g. "Starter"
    maxGroups: number;       // e.g. 1
    rewardBalance: number;   // user's current reward points
    rewardCost: number;      // points required to unlock a slot
    redeeming: boolean;      // true while API call is in-flight
    onUpgrade: () => void;
    onUseRewards: () => void;
    onDismiss: () => void;
}

const GroupLimitModal: React.FC<Props> = ({
    visible,
    planName,
    maxGroups,
    rewardBalance,
    rewardCost,
    redeeming,
    onUpgrade,
    onUseRewards,
    onDismiss,
}) => {
    const canAfford = rewardBalance >= rewardCost;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="warning" size={26} color={D.danger ?? "#ff6b6b"} />
                        </View>
                        <Text style={styles.title}>Group limit reached</Text>
                        <Text style={styles.subtitle}>
                            Your{" "}
                            <Text style={styles.planHighlight}>{planName} plan</Text>{" "}
                            allows a maximum of {maxGroups} group{maxGroups !== 1 ? "s" : ""}.
                            {"\n"}Choose how you'd like to proceed:
                        </Text>

                        {/* Plan pill */}
                        <View style={styles.planPill}>
                            <Ionicons name="time-outline" size={11} color={D.accent} />
                            <Text style={styles.planPillText}>
                                {planName} plan · {maxGroups} group{maxGroups !== 1 ? "s" : ""} max
                            </Text>
                        </View>
                    </View>

                    {/* ── Options ── */}
                    <View style={styles.optionsSection}>

                        {/* Option 1 — Upgrade */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onUpgrade}
                            style={styles.optionRow}
                        >
                            <LinearGradient
                                colors={["#7c8cff22", "#9b59d422"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.optionIconWrap}
                            >
                                <Ionicons name="star" size={19} color={D.accent} />
                            </LinearGradient>
                            <View style={styles.optionText}>
                                <Text style={styles.optionLabel}>Upgrade to Growth</Text>
                                <Text style={styles.optionSub}>
                                    Unlimited groups · £4.99/mo · Cancel any time
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={D.textMuted ?? "#555870"} />
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Option 2 — Reward points */}
                        <TouchableOpacity
                            activeOpacity={canAfford ? 0.8 : 1}
                            onPress={canAfford ? onUseRewards : undefined}
                            style={[
                                styles.optionRow,
                                !canAfford && styles.optionRowDisabled,
                            ]}
                        >
                            <View
                                style={[
                                    styles.optionIconWrap,
                                    {
                                        backgroundColor: canAfford
                                            ? "rgba(56,217,169,0.12)"
                                            : "rgba(255,255,255,0.04)",
                                    },
                                ]}
                            >
                                {redeeming ? (
                                    <ActivityIndicator size="small" color={D.accent2 ?? "#38d9a9"} />
                                ) : (
                                    <Ionicons
                                        name="gift"
                                        size={19}
                                        color={canAfford ? D.accent2 ?? "#38d9a9" : D.textMuted ?? "#555870"}
                                    />
                                )}
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionLabel}>Use reward points</Text>
                                <Text style={styles.optionSub}>
                                    {canAfford
                                        ? `Unlock 1 extra group slot for ${rewardCost} pts`
                                        : `You need ${rewardCost} pts — you have ${rewardBalance} pts`}
                                </Text>

                                {/* Balance row */}
                                <View style={styles.balanceRow}>
                                    <Text style={styles.balanceLabel}>Your balance</Text>
                                    <View style={styles.balanceRight}>
                                        <Text style={styles.balancePts}>
                                            {rewardBalance} pts
                                        </Text>
                                        <View
                                            style={[
                                                styles.balanceBadge,
                                                {
                                                    backgroundColor: canAfford
                                                        ? "rgba(56,217,169,0.12)"
                                                        : "rgba(255,107,107,0.12)",
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.balanceBadgeText,
                                                    {
                                                        color: canAfford
                                                            ? D.accent2 ?? "#38d9a9"
                                                            : D.danger ?? "#ff6b6b",
                                                    },
                                                ]}
                                            >
                                                {canAfford
                                                    ? "Enough to unlock"
                                                    : `Need ${rewardCost - rewardBalance} more`}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={canAfford ? D.textMuted ?? "#555870" : "transparent"}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* ── Dismiss ── */}
                    <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
                        <Text style={styles.dismissText}>Not now — go back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default GroupLimitModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(10,11,22,0.85)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#161821",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: D.border ?? "#2a2d3e",
        overflow: "hidden",
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 24 },
                shadowOpacity: 0.55,
                shadowRadius: 32,
            },
            android: { elevation: 20 },
        }),
    },

    // Header
    header: {
        paddingTop: 28,
        paddingHorizontal: 22,
        paddingBottom: 22,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: D.border ?? "#2a2d3e",
        backgroundColor: "#161821",
    },
    iconWrap: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: "rgba(255,107,107,0.1)",
        borderWidth: 1.5,
        borderColor: "rgba(255,107,107,0.2)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },
    title: {
        fontSize: 18,
        fontWeight: "800",
        color: D.text ?? "#e8eaf6",
        letterSpacing: -0.3,
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 13,
        color: D.textSub ?? "#8b8fa8",
        lineHeight: 21,
        textAlign: "center",
        marginBottom: 14,
    },
    planHighlight: {
        color: D.accent ?? "#7c8cff",
        fontWeight: "700",
    },
    planPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: D.accentSoft ?? "rgba(124,140,255,0.09)",
        borderWidth: 1,
        borderColor: D.accentMed ?? "rgba(124,140,255,0.2)",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    planPillText: {
        fontSize: 11,
        fontWeight: "700",
        color: D.accent ?? "#7c8cff",
    },

    // Options
    optionsSection: {
        padding: 16,
        paddingBottom: 8,
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: D.border ?? "#2a2d3e",
        backgroundColor: "#1e2030",
        marginBottom: 10,
    },
    optionRowDisabled: {
        opacity: 0.55,
    },
    optionIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    optionText: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: D.text ?? "#e8eaf6",
        marginBottom: 2,
    },
    optionSub: {
        fontSize: 12,
        color: D.textMuted ?? "#555870",
        lineHeight: 17,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 4,
        marginBottom: 10,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: D.border ?? "#2a2d3e",
    },
    dividerText: {
        fontSize: 11,
        color: D.textMuted ?? "#555870",
    },

    // Balance row inside rewards option
    balanceRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#161821",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 8,
    },
    balanceLabel: {
        fontSize: 11,
        color: D.textMuted ?? "#555870",
    },
    balanceRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    balancePts: {
        fontSize: 13,
        fontWeight: "700",
        color: D.text ?? "#e8eaf6",
    },
    balanceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 20,
    },
    balanceBadgeText: {
        fontSize: 10,
        fontWeight: "700",
    },

    // Dismiss
    dismissBtn: {
        alignItems: "center",
        paddingVertical: 14,
        paddingBottom: 20,
    },
    dismissText: {
        fontSize: 13,
        fontWeight: "600",
        color: D.textMuted ?? "#555870",
    },
});
