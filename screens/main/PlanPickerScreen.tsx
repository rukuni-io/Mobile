import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Platform,
    Modal,
    AppState,
    AppStateStatus,
    Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";
import { D } from "../../theme/tokens";
import {
    getBillingRedirectUrls,
    extractCheckoutUrl,
    extractSessionId,
    extractApiError,
    openStripeCheckout,
    saveCheckoutSession,
    loadCheckoutSession,
    loadCheckoutPlanSlug,
    clearCheckoutSession,
    verifyCheckoutSession,
} from "../../utils/billingCheckout";

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
        "Continue to secure checkout";
    const confirmTitle =
        plan.slug === "starter" ? "Starter activated" :
        plan.slug === "growth" ? "You're on Growth" : "Enterprise is live";
    const confirmBody =
        plan.slug === "starter"
            ? "You're on the free Starter plan. Create your first group and start saving together."
            : plan.slug === "growth"
            ? "Payment received. Unlimited groups, smart reminders and the full analytics dashboard are unlocked."
            : "Payment received. Your account manager will reach out within 24 hours to complete onboarding.";
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
    CreateGroup: undefined;
};

type CheckoutPhase = "idle" | "preparing" | "success";

// ── Main Screen ────────────────────────────────────────────────────────────────

const PlanPickerScreen: React.FC = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();

    const [selected, setSelected] = useState<string | null>(null);
    const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>("idle");
    const [cancelled, setCancelled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<ApiPlan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [starterSlug, setStarterSlug] = useState<string | null>(null);
    const [activePlanName, setActivePlanName] = useState<string | null>(null);
    const pendingSessionId = useRef<string | null>(null);
    const checkoutOpenedAt = useRef(0);
    const settlingRef = useRef(false);
    const appStateRef = useRef(AppState.currentState);
    const settleCheckoutRef = useRef<() => Promise<void>>(async () => {});

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

    const confirmPlanFromDashboard = async () => {
        const apiUrl = Constants.expoConfig?.extra?.apiUrl;
        const token = await AsyncStorage.getItem("token");
        if (!apiUrl || !token) return false;
        const dashRes = await axios.get<{ user?: { plan?: string } }>(
            `${apiUrl}/user/dashboard`,
            { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        );
        const freshPlan = dashRes.data?.user?.plan;
        if (!freshPlan || freshPlan === "No active plan") return false;
        setActivePlanName(freshPlan);
        return true;
    };

    const settleCheckout = useCallback(async () => {
        const sessionId = pendingSessionId.current || (await loadCheckoutSession());
        if (!sessionId || settlingRef.current) return;
        settlingRef.current = true;
        setCheckoutPhase("preparing");

        try {
            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            const token = await AsyncStorage.getItem("token");

            let paymentStatus: "paid" | "unpaid" | "no_payment_required" | "unknown" = "unknown";
            if (apiUrl && token) {
                for (let i = 0; i < 4; i += 1) {
                    try {
                        paymentStatus = await verifyCheckoutSession(apiUrl, token, sessionId);
                    } catch {
                        paymentStatus = "unknown";
                    }
                    if (paymentStatus === "paid" || paymentStatus === "no_payment_required") break;
                    if (i < 3) await new Promise((r) => setTimeout(r, 1000));
                }
            }

            const paid = paymentStatus === "paid" || paymentStatus === "no_payment_required";

            if (!paid && paymentStatus === "unknown") {
                let activated = false;
                for (let i = 0; i < 3; i += 1) {
                    try {
                        activated = await confirmPlanFromDashboard();
                    } catch {
                        /* ignore */
                    }
                    if (activated) break;
                    await new Promise((r) => setTimeout(r, 800));
                }
                if (activated) {
                    pendingSessionId.current = null;
                    await clearCheckoutSession();
                    await AsyncStorage.removeItem("cache_dashboard_data");
                    setCancelled(false);
                    setCheckoutPhase("success");
                    return;
                }
            }

            if (paid) {
                for (let i = 0; i < 3; i += 1) {
                    try {
                        if (await confirmPlanFromDashboard()) break;
                    } catch {
                        /* webhook may still be attaching the plan */
                    }
                    await new Promise((r) => setTimeout(r, 800));
                }
                pendingSessionId.current = null;
                await clearCheckoutSession();
                await AsyncStorage.removeItem("cache_dashboard_data");
                setCancelled(false);
                setCheckoutPhase("success");
                return;
            }

            pendingSessionId.current = sessionId;
            await AsyncStorage.removeItem("cache_dashboard_data");
            setCancelled(true);
            setCheckoutPhase("idle");
        } finally {
            settlingRef.current = false;
        }
    }, []);

    settleCheckoutRef.current = settleCheckout;

    useEffect(() => {
        let cancelled = false;
        fetchPlans(() => cancelled);

        (async () => {
            const [id, slug] = await Promise.all([
                loadCheckoutSession(),
                loadCheckoutPlanSlug(),
            ]);
            if (cancelled) return;
            if (slug) setSelected(slug);
            if (!id) return;
            pendingSessionId.current = id;
            setCancelled(true);
            if (
                AppState.currentState === "active" &&
                Date.now() - checkoutOpenedAt.current >= 2500
            ) {
                void settleCheckoutRef.current();
            }
        })();

        const onAppState = (next: AppStateStatus) => {
            const prev = appStateRef.current;
            appStateRef.current = next;
            const returnedToForeground =
                (prev === "background" || prev === "inactive") && next === "active";
            if (!returnedToForeground) return;
            if (Date.now() - checkoutOpenedAt.current < 2500) return;
            void settleCheckoutRef.current();
        };
        const appSub = AppState.addEventListener("change", onAppState);

        const onUrl = ({ url }: { url: string }) => {
            const lower = url.toLowerCase();
            if (
                lower.includes("billing/checkout/success") ||
                lower.includes("billing/checkout/cancel") ||
                lower.includes("billing/success") ||
                lower.includes("billing/cancel")
            ) {
                void settleCheckoutRef.current();
            }
        };
        const urlSub = Linking.addEventListener("url", onUrl);
        Linking.getInitialURL().then((url) => {
            if (url) onUrl({ url });
        });

        return () => {
            cancelled = true;
            appSub.remove();
            urlSub.remove();
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (AppState.currentState !== "active") return;
            if (Date.now() - checkoutOpenedAt.current < 2500) return;
            void settleCheckoutRef.current();
        }, []),
    );

    const handleConfirm = async () => {
        if (!selected || !selectedPlan) return;
        setCancelled(false);
        setLoading(true);
        setCheckoutPhase("preparing");
        try {
            const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
            const token = await AsyncStorage.getItem("token");
            if (!apiUrl || !token) throw new Error("Please sign in again to continue.");

            const { successUrl, cancelUrl } = getBillingRedirectUrls(apiUrl);
            const res = await axios.post(
                `${apiUrl}/user/add-plan`,
                {
                    plan_id: selectedPlan.id,
                    success_url: successUrl,
                    cancel_url: cancelUrl,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                },
            );

            const checkoutUrl = extractCheckoutUrl(res.data);
            const sessionId = extractSessionId(res.data);
            const isPaid = selectedPlan.price > 0;

            if (checkoutUrl) {
                if (sessionId) {
                    pendingSessionId.current = sessionId;
                    await saveCheckoutSession(sessionId, selected ?? undefined);
                }
                setCheckoutPhase("idle");
                setLoading(false);
                setCancelled(true);
                checkoutOpenedAt.current = Date.now();
                // Let the preparing overlay unmount before leaving the app.
                // Awaiting Safari / in-app browsers from Expo Go freezes the JS thread.
                setTimeout(() => {
                    openStripeCheckout(checkoutUrl).catch((openErr) => {
                        Dialog.show({
                            type: ALERT_TYPE.DANGER,
                            title: "Couldn’t open checkout",
                            textBody: openErr?.message || "Safari couldn’t open Stripe. Try again.",
                            button: "OK",
                        });
                    });
                }, 250);
                return;
            }

            if (!isPaid && (res.data?.status === "success" || res.data?.data)) {
                await clearCheckoutSession();
                await AsyncStorage.removeItem("cache_dashboard_data");
                setCheckoutPhase("success");
                return;
            }

            throw Object.assign(new Error(extractApiError(res.data)), { data: res.data });
        } catch (err: any) {
            pendingSessionId.current = null;
            await clearCheckoutSession();
            const serverMsg = extractApiError(err);
            const alreadyActive = serverMsg.toLowerCase().includes("already have an active plan");

            if (alreadyActive) {
                Dialog.show({
                    type: ALERT_TYPE.INFO,
                    title: "Plan already active",
                    textBody: serverMsg,
                    button: "Go to Dashboard",
                    onHide: () => navigation.navigate("Dashboard"),
                });
                setCheckoutPhase("idle");
                return;
            }

            Dialog.show({
                type: ALERT_TYPE.DANGER,
                title: "Couldn’t start checkout",
                textBody: serverMsg,
                button: "OK",
            });
            setCheckoutPhase("idle");
        } finally {
            setLoading(false);
        }
    };

    const goToDashboard = () =>
        navigation.navigate("Dashboard");

    // ── Confirmation screen ────────────────────────────────────────────────────
    if (checkoutPhase === "success") {
        const isPaid = selectedPlan ? selectedPlan.price > 0 : true;
        const shownPlan = activePlan ?? {
            name: "Your plan",
            confirmTitle: "You're in",
            confirmBody: "Payment confirmed. Your plan is active.",
            accentColor: P.accent,
            accentSoft: P.accentSoft,
            price: "",
            period: "forever",
            ctaGrad: [P.accent, P.accentMed] as const,
        };
        return (
            <View
                style={[
                    styles.confirmRoot,
                    { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
                ]}
            >
                <StatusBar barStyle="light-content" backgroundColor={P.bg} />

                <View style={styles.successSteps}>
                    <Text style={styles.successStepDone}>Select</Text>
                    <Text style={styles.successStepDot}>·</Text>
                    <Text style={styles.successStepDone}>{isPaid ? "Pay" : "Activate"}</Text>
                    <Text style={styles.successStepDot}>·</Text>
                    <Text style={[styles.successStepNow, { color: shownPlan.accentColor }]}>You're in</Text>
                </View>

                <View
                    style={[
                        styles.confirmIconWrap,
                        {
                            backgroundColor: shownPlan.accentSoft,
                            borderColor: `${shownPlan.accentColor}55`,
                        },
                    ]}
                >
                    <Ionicons name="checkmark" size={34} color={shownPlan.accentColor} />
                </View>

                <Text style={styles.confirmTitle}>{shownPlan.confirmTitle}</Text>
                <Text style={styles.confirmBody}>{shownPlan.confirmBody}</Text>

                <View
                    style={[
                        styles.confirmPlanPill,
                        { borderColor: `${shownPlan.accentColor}30` },
                    ]}
                >
                    <Ionicons name="sparkles" size={16} color={shownPlan.accentColor} />
                    <Text
                        style={[styles.confirmPlanName, { color: shownPlan.accentColor }]}
                    >
                        {shownPlan.name}
                    </Text>
                    <View style={styles.confirmPillDivider} />
                    <Text style={styles.confirmPlanPrice}>
                        {shownPlan.price}
                        {shownPlan.period !== "forever" ? ` · ${shownPlan.period}` : ""}
                    </Text>
                </View>

                {isPaid && (
                    <Text style={styles.successHint}>
                        Stripe confirmed your payment. It can take a few seconds for the dashboard to catch up.
                    </Text>
                )}

                <TouchableOpacity style={styles.confirmCta} onPress={goToDashboard}>
                    <LinearGradient
                        colors={shownPlan.ctaGrad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmCtaGrad}
                    >
                        <Text style={styles.confirmCtaText}>Go to Dashboard</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={() => navigation.navigate("CreateGroup")}
                >
                    <Ionicons name="people-outline" size={18} color={P.accent} />
                    <Text style={styles.secondaryCtaText}>Create your first group</Text>
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
                <TouchableOpacity
                    onPress={goToDashboard}
                    style={styles.headerBackBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={styles.headerBackArrow}>‹</Text>
                </TouchableOpacity>
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
                        {selected && activePlan && selectedPlan?.price
                            ? "Next: a secure Stripe checkout. We never see your card."
                            : "Pick the plan that fits your savings community"}
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
                {cancelled && (
                    <View style={styles.cancelBanner}>
                        <View style={styles.cancelBannerIcon}>
                            <Ionicons name="time-outline" size={22} color={P.warn} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cancelBannerTitle}>Complete payment in Safari</Text>
                            <Text style={styles.cancelBannerBody}>
                                Finish checkout in Safari. The success page may close itself — switch back to Rukuni and we’ll confirm the payment. If it hasn’t landed yet, tap Try again.
                            </Text>
                            <TouchableOpacity onPress={settleCheckout} style={styles.retryStatusBtn}>
                                <Text style={styles.retryStatusText}>Try again</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => setCancelled(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={18} color={P.textMuted} />
                        </TouchableOpacity>
                    </View>
                )}

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
                            onSelect={(key) => {
                                setCancelled(false);
                                setSelected(key);
                            }}
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
                                <View style={styles.ctaInner}>
                                    {selectedPlan && selectedPlan.price > 0 && (
                                        <Ionicons name="lock-closed" size={16} color="#fff" />
                                    )}
                                    <Text style={styles.ctaText}>
                                        {cancelled ? "Resume checkout" : activePlan.label}
                                    </Text>
                                </View>
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

                {selectedPlan && selectedPlan.price > 0 && (
                    <View style={styles.trustRow}>
                        <Ionicons name="shield-checkmark" size={14} color={P.accent2} />
                        <Text style={styles.trustText}>Secured by Stripe</Text>
                        <Text style={styles.trustDot}>·</Text>
                        <Text style={styles.trustText}>Cards never touch Rukuni</Text>
                    </View>
                )}

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

            <Modal visible={checkoutPhase === "preparing"} transparent animationType="fade">
                <View style={styles.prepareOverlay}>
                    <View style={styles.prepareCard}>
                        <View style={styles.prepareIconWrap}>
                            <Ionicons name={loading ? "card" : "sync"} size={26} color={P.accent} />
                        </View>
                        <Text style={styles.prepareTitle}>
                            {loading ? "Opening secure checkout" : "Checking your payment"}
                        </Text>
                        <Text style={styles.prepareBody}>
                            {loading
                                ? "Stripe handles the payment. We never see or store your card details."
                                : "This only takes a moment. Close checkout first if it's still open."}
                        </Text>
                        <ActivityIndicator color={P.accent} style={{ marginTop: 18 }} />
                    </View>
                </View>
            </Modal>
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
    headerBackBtn: {
        marginRight: 2,
    },
    headerBackArrow: {
        fontSize: 36,
        color: P.text,
        lineHeight: 40,
        fontWeight: '300',
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
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    confirmCtaText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
    },
    secondaryCta: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: P.borderHi,
        backgroundColor: P.surface,
    },
    secondaryCtaText: {
        fontSize: 14,
        fontWeight: "700",
        color: P.accent,
    },
    successSteps: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 28,
    },
    successStepDone: {
        fontSize: 12,
        fontWeight: "600",
        color: P.textMuted,
    },
    successStepDot: {
        color: P.textMuted,
        fontSize: 12,
    },
    successStepNow: {
        fontSize: 12,
        fontWeight: "800",
    },
    successHint: {
        fontSize: 12,
        color: P.textMuted,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 24,
        maxWidth: 300,
    },
    ctaInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    trustRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 12,
    },
    trustText: {
        fontSize: 11,
        color: P.textMuted,
        fontWeight: "600",
    },
    trustDot: {
        fontSize: 11,
        color: P.textMuted,
    },
    cancelBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: P.warnSoft,
        borderWidth: 1,
        borderColor: "rgba(245,158,11,0.35)",
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    cancelBannerIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: "rgba(245,158,11,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBannerTitle: {
        color: P.warn,
        fontSize: 13,
        fontWeight: "800",
        marginBottom: 2,
    },
    cancelBannerBody: {
        color: P.textSub,
        fontSize: 12,
        lineHeight: 17,
    },
    retryStatusBtn: {
        alignSelf: "flex-start",
        marginTop: 10,
        backgroundColor: "rgba(245,158,11,0.18)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    retryStatusText: {
        color: P.warn,
        fontSize: 12,
        fontWeight: "800",
    },
    prepareOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.72)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
    },
    prepareCard: {
        width: "100%",
        backgroundColor: P.surfaceHi,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: P.borderHi,
        paddingVertical: 32,
        paddingHorizontal: 24,
        alignItems: "center",
    },
    prepareIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: P.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    prepareTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: P.text,
        marginBottom: 8,
        textAlign: "center",
    },
    prepareBody: {
        fontSize: 13,
        color: P.textSub,
        textAlign: "center",
        lineHeight: 20,
        maxWidth: 260,
    },
});
