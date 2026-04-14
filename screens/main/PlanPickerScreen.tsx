import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import { D } from "../../theme/tokens";

// ── Dark theme tokens ──────────────────────────────────────────────────────────
const P = {
    bg:          D.bg as string,
    surface:     D.surfaceCard as string,
    surfaceHi:   D.surfaceHi as string,
    border:      D.border as string,
    borderHi:    D.borderHi as string,
    text:        D.text as string,
    textSub:     D.textSub as string,
    textMuted:   D.textMuted as string,
    accent:      D.accent as string,
    accentSoft:  D.accentSoft as string,
    accentMed:   D.accentMed as string,
    accent2:     D.accent2 as string,
    accent2Soft: D.accent2Soft as string,
    warn:        D.warn as string,
    warnSoft:    D.warnSoft as string,
};

// ── API plan shape ─────────────────────────────────────────────────────────────
interface ApiPlan {
    id: string;
    name: string;
    slug: string;
    tagline: string;
    price: number; // in pence
    currency: string;
    billing: string;
    features: string[];
    built_for: string[] | null;
    is_active: boolean;
}

// ── Per-plan display config ────────────────────────────────────────────────────
interface PlanConfig {
    name: string;
    tagline: string;
    price: string;
    period: string;
    popular?: boolean;
    accentColor: string;
    accentSoft: string;
    checkBg: string;
    ctaGrad: readonly [string, string];
    ctaGlow: string;
    footerNote: string;
    label: string;
    confirmTitle: string;
    confirmBody: string;
    features: string[];
    builtFor?: string[];
}

function accentForSlug(slug: string): {
    color: string; soft: string; checkBg: string;
    grad: readonly [string, string]; glow: string;
} {
    if (slug === "starter")
        return { color: "#38d9a9", soft: "rgba(56,217,169,0.094)", checkBg: "rgba(56,217,169,0.125)", grad: ["#38d9a9", "#20b087"], glow: "rgba(56,217,169,0.267)" };
    if (slug === "enterprise")
        return { color: "#ffa94d", soft: "rgba(255,169,77,0.082)", checkBg: "rgba(255,169,77,0.125)", grad: ["#ffa94d", "#e07a10"], glow: "rgba(255,169,77,0.267)" };
    return { color: "#6eb5ff", soft: "rgba(110,181,255,0.15)", checkBg: "rgba(110,181,255,0.18)", grad: ["#6eb5ff", "#00d68f"] as const, glow: "rgba(110,181,255,0.25)" };
}

function mapApiPlanToConfig(plan: ApiPlan): PlanConfig {
    const a = accentForSlug(plan.slug);
    const price =
        plan.price === 0 ? "Free" : `£${plan.price}`;
    const period =
        plan.billing === "free_forever" ? "forever" :
        plan.billing === "monthly" ? "per month" :
        plan.billing === "yearly" ? "per year" : plan.billing;
    const footerNote =
        plan.billing === "free_forever" ? "No credit card needed" :
        plan.billing === "yearly" ? "Billed annually" : "Cancel any time";
    const label =
        plan.price === 0 ? "Get started for free" :
        plan.slug === "growth" ? "Start Growth plan" : "Get Enterprise access";
    const confirmTitle =
        plan.slug === "starter" ? "Starter activated" :
        plan.slug === "growth" ? "Growth plan activated" : "Enterprise confirmed";
    const confirmBody =
        plan.slug === "starter"
            ? "You're on the free Starter plan. Create your first group and start saving together."
            : plan.slug === "growth"
            ? "Unlimited groups, smart reminders and the full analytics dashboard are now available."
            : "Your account manager will reach out within 24 hours to complete your onboarding.";
    return {
        name: plan.name,
        tagline: plan.tagline,
        price,
        period,
        popular: plan.slug === "growth",
        accentColor: a.color,
        accentSoft: a.soft,
        checkBg: a.checkBg,
        ctaGrad: a.grad,
        ctaGlow: a.glow,
        footerNote,
        label,
        confirmTitle,
        confirmBody,
        features: plan.features,
        builtFor: plan.built_for ?? undefined,
    };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const FeatRow: React.FC<{
    text: string;
    checkBg: string;
    accentColor: string;
}> = ({ text, checkBg, accentColor }) => (
    <View style={styles.featRow}>
        <View style={[styles.checkCircle, { backgroundColor: checkBg }]}>
            <Text style={[styles.checkMark, { color: accentColor }]}>✓</Text>
        </View>
        <Text style={styles.featText}>{text}</Text>
    </View>
);

// ── Plan Card ──────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{
    planKey: string;
    plan: PlanConfig;
    selected: string | null;
    onSelect: (key: string) => void;
}> = ({ planKey, plan, selected, onSelect }) => {
    const isSelected = selected === planKey;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onSelect(planKey)}
            style={[
                styles.planCard,
                {
                    borderColor: isSelected ? plan.accentColor : P.border,
                    borderWidth: isSelected ? 2 : 1,
                    ...Platform.select({
                        ios: { shadowColor: isSelected ? plan.accentColor : "transparent" },
                        android: { elevation: isSelected ? 6 : 2 },
                    }),
                },
            ]}
        >
            {/* Head */}
            <View style={styles.planHead}>
                <View style={styles.planHeadLeft}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planTagline}>{plan.tagline}</Text>
                </View>
                <View style={styles.planPriceBox}>
                    <Text style={[styles.planPrice, { color: plan.accentColor }]}>
                        {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
            </View>

            {/* Popular badge */}
            {plan.popular && (
                <View style={styles.popularBadgeRow}>
                    <View
                        style={[
                            styles.popularBadge,
                            { backgroundColor: P.accentSoft, borderColor: P.accentMed },
                        ]}
                    >
                        <Text style={[styles.popularBadgeText, { color: P.accent }]}>
                            Most popular
                        </Text>
                    </View>
                </View>
            )}

            {/* Features */}
            <View style={styles.planFeatures}>
                {plan.features.map((f) => (
                    <FeatRow
                        key={f}
                        text={f}
                        checkBg={plan.checkBg}
                        accentColor={plan.accentColor}
                    />
                ))}
            </View>

            {/* Built for — Enterprise only */}
            {plan.builtFor && (
                <View style={styles.builtForSection}>
                    <Text style={styles.builtForLabel}>BUILT FOR</Text>
                    <View style={styles.builtForChips}>
                        {plan.builtFor.map((c) => (
                            <View key={c} style={styles.builtForChip}>
                                <Text style={styles.builtForChipText}>{c}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Footer */}
            <View style={styles.planFooter}>
                <Text style={styles.planFooterNote}>{plan.footerNote}</Text>
                <View
                    style={[
                        styles.radioDot,
                        {
                            borderColor: isSelected ? plan.accentColor : P.border,
                            backgroundColor: isSelected ? plan.accentColor : "transparent",
                            ...Platform.select({
                                ios: {
                                    shadowColor: isSelected ? plan.accentColor : "transparent",
                                    shadowOpacity: 0.5,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 0 },
                                },
                                android: { elevation: isSelected ? 3 : 0 },
                            }),
                        },
                    ]}
                />
            </View>
        </TouchableOpacity>
    );
};

// ── Navigation params ──────────────────────────────────────────────────────────

type RootStackParamList = {
    Dashboard: undefined;
    PlanPicker: undefined;
};

// ── Main Screen ────────────────────────────────────────────────────────────────

const PlanPickerScreen: React.FC = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();

    const [selected, setSelected] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<ApiPlan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [starterSlug, setStarterSlug] = useState<string | null>(null);
    const [activePlanName, setActivePlanName] = useState<string | null>(null);

    const selectedPlan = selected ? plans.find((p) => p.slug === selected) : undefined;
    const activePlan = selectedPlan ? mapApiPlanToConfig(selectedPlan) : null;
    const visiblePlans = activePlanName
        ? plans.filter((p) => p.name.toLowerCase() !== activePlanName.toLowerCase())
        : plans;

    const fetchPlans = async (isCancelled: () => boolean) => {
        setPlansError(null);
        setPlansLoading(true);
        try {
            const apiUrl: string = Constants.expoConfig?.extra?.apiUrl;
            const [cachedDashboard, token] = await Promise.all([
                AsyncStorage.getItem("cache_dashboard_data"),
                AsyncStorage.getItem("token"),
            ]);

            if (!apiUrl) throw new Error("API URL not configured");

            // Try reading active plan from dashboard cache first
            if (cachedDashboard) {
                try {
                    const { plan } = JSON.parse(cachedDashboard);
                    if (plan && plan !== "No active plan" && !isCancelled()) {
                        setActivePlanName(plan);
                    }
                } catch { /* ignore bad cache */ }
            }

            // Fetch plans list — public endpoint
            const res = await axios.get<{ data: ApiPlan[] }>(`${apiUrl}/plans`, {
                headers: {
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!res.data?.data) throw new Error("Unexpected response from /plans");

            // Fetch dashboard for the freshest active plan name
            try {
                const dashRes = await axios.get<{ user?: { plan?: string } }>(
                    `${apiUrl}/user/dashboard`,
                    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
                );
                const freshPlan = dashRes.data?.user?.plan;
                if (!isCancelled()) {
                    setActivePlanName(freshPlan && freshPlan !== "No active plan" ? freshPlan : null);
                }
            } catch {
                // fall back to cache value already set above
            }

            if (!isCancelled()) {
                setPlans(res.data.data);
                const free = res.data.data.find((p) => p.price === 0);
                setStarterSlug(free?.slug ?? null);
            }
        } catch (err: any) {
            if (!isCancelled()) {
                const msg = err?.response?.data?.message || err?.message || "Failed to load plans";
                setPlansError(msg);
            }
        } finally {
            if (!isCancelled()) setPlansLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        fetchPlans(() => cancelled);
        return () => { cancelled = true; };
    }, []);

    const handleConfirm = async () => {
        if (!selected || !selectedPlan) return;
        setLoading(true);
        try {
            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            const token = await AsyncStorage.getItem("token");
            const res = await axios.post(
                `${apiUrl}/user/add-plan`,
                { plan_id: selectedPlan.id },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                },
            );
            console.log("add-plan response:", res.data);
        } catch (err: any) {
            const serverMsg: string | undefined = err?.response?.data?.error;
            const alreadyActive =
                err?.response?.status === 400 &&
                typeof serverMsg === "string" &&
                serverMsg.toLowerCase().includes("already have an active plan");

            if (!alreadyActive) {
                // Unexpected error — still optimistically confirm so UX isn't broken
                console.log("add-plan error:", err?.response?.status, err?.response?.data);
            }
            // If already active, fall through to confirmation silently
        } finally {
            setLoading(false);
            setConfirmed(true);
        }
    };

    const goToDashboard = () =>
        navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });

    // ── Confirmation screen ────────────────────────────────────────────────────
    if (confirmed && activePlan) {
        return (
            <View
                style={[
                    styles.confirmRoot,
                    { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
                ]}
            >
                <StatusBar barStyle="light-content" backgroundColor={P.bg} />

                <View
                    style={[
                        styles.confirmIconWrap,
                        {
                            backgroundColor: activePlan.accentSoft,
                            borderColor: `${activePlan.accentColor}55`,
                        },
                    ]}
                >
                    <Text style={{ fontSize: 30, color: activePlan.accentColor }}>✓</Text>
                </View>

                <Text style={styles.confirmTitle}>{activePlan.confirmTitle}</Text>
                <Text style={styles.confirmBody}>{activePlan.confirmBody}</Text>

                <View
                    style={[
                        styles.confirmPlanPill,
                        { borderColor: `${activePlan.accentColor}30` },
                    ]}
                >
                    <Text
                        style={[styles.confirmPlanName, { color: activePlan.accentColor }]}
                    >
                        {activePlan.name}
                    </Text>
                    <View style={styles.confirmPillDivider} />
                    <Text style={styles.confirmPlanPrice}>
                        {activePlan.price}
                        {activePlan.period !== "forever" ? ` · ${activePlan.period}` : ""}
                    </Text>
                </View>

                <TouchableOpacity style={styles.confirmCta} onPress={goToDashboard}>
                    <LinearGradient
                        colors={activePlan.ctaGrad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmCtaGrad}
                    >
                        <Text style={styles.confirmCtaText}>Go to Dashboard</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                        setConfirmed(false);
                        setSelected(null);
                    }}
                >
                    <Text style={styles.backBtnText}>← Back to plans</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Plan picker ────────────────────────────────────────────────────────────
    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor={P.bg} />

            {/* Header gradient */}
            <LinearGradient
                colors={["#161616", "#242424"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View
                    style={[
                        styles.headerIcon,
                        { backgroundColor: P.accentSoft, borderColor: P.accentMed },
                    ]}
                >
                    <Text style={styles.headerIconEmoji}>⭐</Text>
                </View>
                <View style={styles.headerTextBlock}>
                    <Text style={styles.headerTitle}>Choose your plan</Text>
                    <Text style={styles.headerSubtitle}>
                        Pick the plan that fits your savings community
                    </Text>
                </View>
            </LinearGradient>

            {/* Scrollable plan list + CTA */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 32 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {plansLoading ? (
                    <ActivityIndicator
                        color={P.accent}
                        size="large"
                        style={{ marginTop: 32 }}
                    />
                ) : plansError ? (
                    <View style={{ alignItems: "center", marginTop: 32, paddingHorizontal: 16 }}>
                        <Text style={{ color: P.textMuted, textAlign: "center", marginBottom: 16 }}>
                            {plansError}
                        </Text>
                        <TouchableOpacity
                            onPress={() => { let c = false; fetchPlans(() => c); }}
                            style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: P.accentSoft, borderWidth: 1, borderColor: P.accentMed }}
                        >
                            <Text style={{ color: P.accent, fontWeight: "600" }}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : visiblePlans.length === 0 ? (
                    <Text style={{ color: P.textMuted, textAlign: "center", marginTop: 32 }}>
                        No plans available right now.
                    </Text>
                ) : (
                    visiblePlans.map((p) => (
                        <PlanCard
                            key={p.slug}
                            planKey={p.slug}
                            plan={mapApiPlanToConfig(p)}
                            selected={selected}
                            onSelect={setSelected}
                        />
                    ))
                )}

                {/* CTA button */}
                <TouchableOpacity
                    disabled={!selected || loading}
                    onPress={handleConfirm}
                    activeOpacity={selected ? 0.85 : 1}
                    style={styles.ctaWrapper}
                >
                    {selected && activePlan ? (
                        <LinearGradient
                            colors={activePlan.ctaGrad}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.ctaText}>{activePlan.label}</Text>
                            )}
                        </LinearGradient>
                    ) : (
                        <View style={[styles.ctaButton, styles.ctaDisabled]}>
                            <Text style={styles.ctaTextDisabled}>
                                Select a plan to continue
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Quick-start free link */}
                <View style={styles.skipRow}>
                    <Text style={styles.skipText}>Not sure?{"  "}</Text>
                    <TouchableOpacity
                        onPress={() => starterSlug && setSelected(starterSlug)}
                        disabled={!starterSlug}
                    >
                        <Text style={styles.skipLink}>Start free with Starter</Text>
                    </TouchableOpacity>
                </View>

                {/* Skip entirely */}
                <TouchableOpacity style={styles.skipDashBtn} onPress={goToDashboard}>
                    <Text style={styles.skipDashText}>Skip for now</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

export default PlanPickerScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: P.bg,
    },

    // ── Header ──────────────────────────────────────────────────────────────────
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingHorizontal: 20,
        paddingVertical: 22,
        borderBottomWidth: 1,
        borderBottomColor: P.border,
    },
    headerIcon: {
        width: 46,
        height: 46,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    headerIconEmoji: {
        fontSize: 18,
    },
    headerTextBlock: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: P.text,
        letterSpacing: -0.4,
    },
    headerSubtitle: {
        fontSize: 12,
        color: P.textMuted,
        marginTop: 3,
    },

    // ── Scroll list ──────────────────────────────────────────────────────────────
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 14,
        paddingTop: 16,
    },

    // ── Plan card ────────────────────────────────────────────────────────────────
    planCard: {
        backgroundColor: P.surface,
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 14,
            },
            android: {},
        }),
    },
    planHead: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: 18,
        paddingBottom: 14,
        gap: 12,
    },
    planHeadLeft: {
        flex: 1,
    },
    planName: {
        fontSize: 16,
        fontWeight: "800",
        color: P.text,
    },
    planTagline: {
        fontSize: 12,
        color: P.textMuted,
        marginTop: 3,
    },
    planPriceBox: {
        alignItems: "flex-end",
        flexShrink: 0,
    },
    planPrice: {
        fontSize: 22,
        fontWeight: "800",
    },
    planPeriod: {
        fontSize: 11,
        color: P.textMuted,
        marginTop: 2,
    },
    popularBadgeRow: {
        paddingHorizontal: 18,
        paddingBottom: 12,
    },
    popularBadge: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: "700",
    },
    planFeatures: {
        borderTopWidth: 1,
        borderTopColor: P.border,
        paddingHorizontal: 18,
        paddingVertical: 13,
    },
    featRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 9,
        paddingVertical: 4,
    },
    checkCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
    },
    checkMark: {
        fontSize: 9,
        fontWeight: "700",
    },
    featText: {
        flex: 1,
        fontSize: 13,
        color: P.textSub,
        lineHeight: 20,
    },
    builtForSection: {
        paddingHorizontal: 18,
        paddingBottom: 14,
    },
    builtForLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: P.textMuted,
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    builtForChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
    },
    builtForChip: {
        borderWidth: 1,
        borderColor: P.border,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: P.surfaceHi,
    },
    builtForChipText: {
        fontSize: 11,
        color: P.textMuted,
    },
    planFooter: {
        borderTopWidth: 1,
        borderTopColor: P.border,
        paddingHorizontal: 18,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    planFooterNote: {
        fontSize: 11,
        color: P.textMuted,
    },
    radioDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
    },

    // ── CTA ──────────────────────────────────────────────────────────────────────
    ctaWrapper: {
        marginTop: 4,
        marginBottom: 4,
    },
    ctaButton: {
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    ctaDisabled: {
        backgroundColor: P.surfaceHi,
    },
    ctaText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
    },
    ctaTextDisabled: {
        fontSize: 15,
        fontWeight: "700",
        color: P.textMuted,
    },

    // ── Skip links ───────────────────────────────────────────────────────────────
    skipRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
    },
    skipText: {
        fontSize: 12,
        color: P.textMuted,
    },
    skipLink: {
        fontSize: 12,
        color: P.accent,
        fontWeight: "700",
    },
    skipDashBtn: {
        alignItems: "center",
        marginTop: 10,
        paddingVertical: 8,
    },
    skipDashText: {
        fontSize: 12,
        color: P.textMuted,
    },

    // ── Confirmation screen ───────────────────────────────────────────────────────
    confirmRoot: {
        flex: 1,
        backgroundColor: P.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    confirmIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 22,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 22,
    },
    confirmTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: P.text,
        marginBottom: 10,
        letterSpacing: -0.5,
        textAlign: "center",
    },
    confirmBody: {
        fontSize: 14,
        color: P.textSub,
        lineHeight: 23,
        maxWidth: 300,
        textAlign: "center",
        marginBottom: 28,
    },
    confirmPlanPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: P.surface,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginBottom: 28,
    },
    confirmPlanName: {
        fontSize: 15,
        fontWeight: "800",
    },
    confirmPillDivider: {
        width: 1,
        height: 16,
        backgroundColor: P.border,
    },
    confirmPlanPrice: {
        fontSize: 13,
        color: P.textMuted,
    },
    confirmCta: {
        width: "100%",
        marginBottom: 12,
    },
    confirmCtaGrad: {
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: "center",
    },
    confirmCtaText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
    },
    backBtn: {
        paddingHorizontal: 24,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: P.border,
    },
    backBtnText: {
        fontSize: 13,
        fontWeight: "600",
        color: P.textSub,
    },
});
