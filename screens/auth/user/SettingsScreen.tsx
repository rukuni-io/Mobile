import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Platform,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { D } from "../../../theme/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────
type RootStackParamList = { Dashboard: undefined };

interface ToggleState {
    push: boolean;
    email: boolean;
    payment: boolean;
    bio: boolean;
    dark: boolean;
}

// ─── Static Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: D.bg },
    scroll: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 28,
        paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0,
    },
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.13)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginBottom: 16,
    },
    backBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    headerTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#fff",
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    headerSub: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
    body: { paddingHorizontal: 16 },
    versionRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 12,
        marginBottom: 4,
    },
    versionPill: {
        backgroundColor: D.surfaceHi,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 3,
    },
    versionText: { fontSize: 11, color: D.textMuted },
    sectionLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: D.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginTop: 16,
        marginBottom: 10,
    },
    card: {
        backgroundColor: D.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: D.border,
        paddingHorizontal: 18,
        paddingVertical: 4,
        marginBottom: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    rowLast: { borderBottomWidth: 0 },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
    },
    rowLabel: { flex: 1, fontSize: 14, color: D.textSub, fontWeight: "500" },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowValue: { fontSize: 14, fontWeight: "600", color: D.textMuted },
});

// ─── Sub-Components ───────────────────────────────────────────────────────────
const SecLabel: React.FC<{ text: string }> = ({ text }) => (
    <Text style={styles.sectionLabel}>{text}</Text>
);

const SettingsRow: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    iconBg?: string;
    iconColor?: string;
    label: string;
    value?: string;
    valueColor?: string;
    toggle?: boolean;
    toggleValue?: boolean;
    onToggle?: (v: boolean) => void;
    onPress?: () => void;
    last?: boolean;
}> = ({
    icon,
    iconBg,
    iconColor,
    label,
    value,
    valueColor,
    toggle,
    toggleValue,
    onToggle,
    onPress,
    last,
}) => (
        <TouchableOpacity
            style={[styles.row, last && styles.rowLast]}
            onPress={onPress}
            activeOpacity={toggle || !onPress ? 1 : 0.7}
        >
            <View
                style={[styles.iconWrap, { backgroundColor: iconBg ?? D.accentSoft }]}
            >
                <Ionicons name={icon} size={18} color={iconColor ?? D.accent} />
            </View>
            <Text style={styles.rowLabel}>{label}</Text>
            {toggle ? (
                <Switch
                    value={toggleValue}
                    onValueChange={onToggle}
                    trackColor={{ false: D.toggleBg, true: D.accent }}
                    thumbColor="#fff"
                    ios_backgroundColor={D.toggleBg}
                />
            ) : (
                <View style={styles.rowRight}>
                    {value ? (
                        <Text
                            style={[styles.rowValue, valueColor ? { color: valueColor } : {}]}
                        >
                            {value}
                        </Text>
                    ) : null}
                    {onPress && (
                        <Ionicons name="chevron-forward" size={14} color={D.textMuted} />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );

// ─── Main Screen ─────────────────────────────────────────────────────────────
const SettingsScreen: React.FC = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [s, setS] = useState<ToggleState>({
        push: true,
        email: true,
        payment: true,
        bio: false,
        dark: true,
    });

    const tog = (key: keyof ToggleState, label: string) => {
        setS((prev) => {
            const next = !prev[key];
            Toast.show({
                type: "success",
                text1: `${label} ${next ? "enabled" : "disabled"}`,
            });
            return { ...prev, [key]: next };
        });
    };

    const info = (msg: string) => Toast.show({ type: "info", text1: msg });

    return (
        <View style={styles.root}>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent
            />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <LinearGradient
                    colors={["#0f1c35", "#1a2d52", "#1e3a6e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <SafeAreaView>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={16} color="#fff" />
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>⚙️ Settings</Text>
                        <Text style={styles.headerSub}>Manage your app preferences</Text>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {/* ── App Version ── */}
                    <View style={styles.versionRow}>
                        <View style={styles.versionPill}>
                            <Text style={styles.versionText}>v1.0.0</Text>
                        </View>
                    </View>

                    {/* ── Notifications ── */}
                    <SecLabel text="Notifications" />
                    <View style={styles.card}>
                        <SettingsRow
                            icon="notifications-outline"
                            iconBg={D.accentSoft}
                            iconColor={D.accent}
                            label="Push Notifications"
                            toggle
                            toggleValue={s.push}
                            onToggle={() => tog("push", "Push notifications")}
                        />
                        <SettingsRow
                            icon="mail-outline"
                            iconBg={D.accent2Soft}
                            iconColor={D.accent2}
                            label="Email Alerts"
                            toggle
                            toggleValue={s.email}
                            onToggle={() => tog("email", "Email alerts")}
                        />
                        <SettingsRow
                            icon="card-outline"
                            iconBg={D.accentSoft}
                            iconColor={D.accent}
                            label="Payment Reminders"
                            toggle
                            toggleValue={s.payment}
                            onToggle={() => tog("payment", "Payment reminders")}
                            last
                        />
                    </View>

                    {/* ── Security & Privacy ── */}
                    <SecLabel text="Security & Privacy" />
                    <View style={styles.card}>
                        <SettingsRow
                            icon="document-text-outline"
                            iconBg={D.warnSoft}
                            iconColor={D.warn}
                            label="Privacy Policy"
                            onPress={() => info("Opening privacy policy…")}
                        />
                        <SettingsRow
                            icon="newspaper-outline"
                            iconBg="rgba(59,130,246,0.12)"
                            iconColor="#3b82f6"
                            label="Terms of Service"
                            onPress={() => info("Opening terms of service…")}
                            last
                        />
                    </View>

                    {/* ── Preferences ── */}
                    <SecLabel text="Preferences" />
                    <View style={styles.card}>
                        <SettingsRow
                            icon="cash-outline"
                            iconBg={D.accent2Soft}
                            iconColor={D.accent2}
                            label="Currency"
                            value="GBP £"
                            onPress={() => info("Currency settings coming soon")}
                        />
                        <SettingsRow
                            icon="globe-outline"
                            iconBg="rgba(59,130,246,0.12)"
                            iconColor="#3b82f6"
                            label="Language"
                            value="English"
                            onPress={() => info("Language settings coming soon")}
                            last
                        />
                    </View>

                    {/* ── Account ── */}
                    <SecLabel text="Account" />
                    <View style={styles.card}>
                        <SettingsRow
                            icon="log-out-outline"
                            iconBg={D.dangerSoft}
                            iconColor={D.danger}
                            label="Sign Out"
                            valueColor={D.danger}
                            onPress={() => info("Signing out…")}
                        />
                        <SettingsRow
                            icon="warning-outline"
                            iconBg={D.dangerSoft}
                            iconColor={D.danger}
                            label="Clear App Data"
                            onPress={() => info("App data cleared")}
                            last
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

export default SettingsScreen;
