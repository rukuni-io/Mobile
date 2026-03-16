import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity,
    Text,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    TextInput,
    Animated,
    ActivityIndicator,
    Dimensions,
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { D } from '../../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FREQUENCY_OPTIONS = [
    { value: 'daily',   label: 'Daily' },
    { value: 'weekly',  label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

const getScheduleDates = (
    startDate: string,
    frequency: string,
    payDay: string,
    weekday: string,
    count: number,
): Date[] => {
    const dates: Date[] = [];
    const base = new Date(startDate);
    if (frequency === 'monthly' && payDay) {
        for (let i = 0; i < count; i++) {
            const d = new Date(base);
            d.setMonth(d.getMonth() + i);
            d.setDate(parseInt(payDay));
            dates.push(d);
        }
    } else if (frequency === 'weekly' && weekday !== '') {
        const targetDay = parseInt(weekday);
        const d = new Date(base);
        while (d.getDay() !== targetDay) d.setDate(d.getDate() + 1);
        for (let i = 0; i < count; i++) {
            dates.push(new Date(d));
            d.setDate(d.getDate() + 7);
        }
    } else if (frequency === 'daily') {
        for (let i = 0; i < count; i++) {
            const d = new Date(base);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
    }
    return dates;
};

// ─── Step Configuration ───────────────────────────────────────────────────────
const STEPS = [
    { id: 1, label: 'Group Info', icon: 'wallet-outline' },
    { id: 2, label: 'Schedule', icon: 'calendar-outline' },
    { id: 3, label: 'Invite', icon: 'people-outline' },
    { id: 4, label: 'Review', icon: 'checkmark-circle-outline' },
];

// ─── Form State Interface ─────────────────────────────────────────────────────
interface FormState {
    title: string;
    total_users: string;
    target_amount: string;
    expected_start_date: string;
    contribution_frequency: string;
    payment_out_day: string;
    payment_out_weekday: string;
    members_emails: string[];
}

interface FormErrors {
    [key: string]: string;
}

// ─── Step Indicator Component ─────────────────────────────────────────────────
const StepIndicator = ({ currentStep }: { currentStep: number }) => {
    return (
        <View style={stepStyles.container}>
            {STEPS.map((step, index) => {
                const isDone = step.id < currentStep;
                const isActive = step.id === currentStep;
                const isLast = index === STEPS.length - 1;

                return (
                    <View key={step.id} style={stepStyles.stepWrapper}>
                        <View style={stepStyles.stepColumn}>
                            <View style={[
                                stepStyles.circle,
                                isDone && stepStyles.circleDone,
                                isActive && stepStyles.circleActive,
                            ]}>
                                {isDone ? (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                ) : (
                                    <Ionicons
                                        name={step.icon as any}
                                        size={16}
                                        color={isActive ? D.accent : D.textMuted}
                                    />
                                )}
                            </View>
                            <Text style={[
                                stepStyles.label,
                                isActive && stepStyles.labelActive,
                                isDone && stepStyles.labelDone,
                            ]}>
                                {step.label}
                            </Text>
                        </View>
                        {!isLast && (
                            <View style={[
                                stepStyles.line,
                                isDone && stepStyles.lineDone,
                            ]} />
                        )}
                    </View>
                );
            })}
        </View>
    );
};

const stepStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 10,
        marginBottom: 24,
    },
    stepWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
    },
    stepColumn: {
        alignItems: 'center',
        gap: 6,
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: D.surfaceHi,
        borderWidth: 2,
        borderColor: D.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleDone: {
        backgroundColor: D.accent,
        borderColor: D.accent,
    },
    circleActive: {
        borderColor: D.accent,
        backgroundColor: D.accentMed,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        color: D.textMuted,
        textAlign: 'center',
        maxWidth: 60,
    },
    labelActive: {
        color: D.accent,
    },
    labelDone: {
        color: D.accent2,
    },
    line: {
        flex: 1,
        height: 2,
        backgroundColor: D.border,
        marginTop: 17,
        marginHorizontal: 4,
    },
    lineDone: {
        backgroundColor: D.accent,
    },
});

// ─── Field Component ──────────────────────────────────────────────────────────
const Field = ({
    label,
    icon,
    hint,
    error,
    children,
}: {
    label: string;
    icon?: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}) => (
    <View style={fieldStyles.container}>
        <View style={fieldStyles.labelRow}>
            <View style={fieldStyles.labelLeft}>
                {icon && <Ionicons name={icon as any} size={14} color={D.textSub} style={{ marginRight: 6 }} />}
                <Text style={fieldStyles.label}>{label}</Text>
            </View>
            {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
        </View>
        {children}
        {error && (
            <View style={fieldStyles.errorRow}>
                <Ionicons name="warning" size={12} color={D.danger} />
                <Text style={fieldStyles.error}>{error}</Text>
            </View>
        )}
    </View>
);

const fieldStyles = StyleSheet.create({
    container: {
        marginBottom: 18,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    labelLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: D.textSub,
        letterSpacing: 0.3,
    },
    hint: {
        fontSize: 11,
        color: D.textMuted,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    error: {
        fontSize: 11,
        color: D.danger,
    },
});

// ─── Styled TextInput Component ───────────────────────────────────────────────
const StyledInput = ({
    value,
    onChangeText,
    placeholder,
    prefix,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    editable = true,
}: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    prefix?: string;
    keyboardType?: 'default' | 'numeric' | 'email-address' | 'decimal-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    editable?: boolean;
}) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[
            inputStyles.container,
            isFocused && inputStyles.containerFocused,
            !editable && inputStyles.containerDisabled,
        ]}>
            {prefix && (
                <View style={[inputStyles.prefix, isFocused && inputStyles.prefixFocused]}>
                    <Text style={[inputStyles.prefixText, isFocused && inputStyles.prefixTextFocused]}>
                        {prefix}
                    </Text>
                </View>
            )}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={D.textMuted}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                editable={editable}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={[inputStyles.input, !editable && inputStyles.inputDisabled]}
            />
        </View>
    );
};

const inputStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 12,
        overflow: 'hidden',
    },
    containerFocused: {
        borderColor: D.borderFocus,
    },
    containerDisabled: {
        backgroundColor: D.bg,
    },
    prefix: {
        paddingHorizontal: 14,
        borderRightWidth: 1,
        borderRightColor: D.border,
        backgroundColor: D.surface,
        height: 48,
        justifyContent: 'center',
    },
    prefixFocused: {
        borderRightColor: D.borderFocus,
    },
    prefixText: {
        fontSize: 15,
        fontWeight: '700',
        color: D.textSub,
    },
    prefixTextFocused: {
        color: D.accent,
    },
    input: {
        flex: 1,
        paddingHorizontal: 14,
        height: 48,
        fontSize: 15,
        color: D.text,
    },
    inputDisabled: {
        color: D.textMuted,
    },
});

// ─── Select Input Component ───────────────────────────────────────────────────
const SelectInput = ({
    value,
    options,
    onSelect,
    placeholder,
}: {
    value: string;
    options: { value: string; label: string }[];
    onSelect: (value: string) => void;
    placeholder: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.value === value);

    return (
        <View>
            <TouchableOpacity
                style={[selectStyles.trigger, isOpen && selectStyles.triggerOpen]}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.8}
            >
                <Text style={[
                    selectStyles.triggerText,
                    !selectedOption && selectStyles.placeholder,
                ]}>
                    {selectedOption?.label || placeholder}
                </Text>
                <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={D.textSub}
                />
            </TouchableOpacity>
            {isOpen && (
                <View style={selectStyles.dropdown}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    selectStyles.option,
                                    option.value === value && selectStyles.optionSelected,
                                ]}
                                onPress={() => {
                                    onSelect(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                <Text style={[
                                    selectStyles.optionText,
                                    option.value === value && selectStyles.optionTextSelected,
                                ]}>
                                    {option.label}
                                </Text>
                                {option.value === value && (
                                    <Ionicons name="checkmark" size={16} color={D.accent} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const selectStyles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    triggerOpen: {
        borderColor: D.borderFocus,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    triggerText: {
        fontSize: 15,
        color: D.text,
    },
    placeholder: {
        color: D.textMuted,
    },
    dropdown: {
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5,
        borderTopWidth: 0,
        borderColor: D.borderFocus,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    optionSelected: {
        backgroundColor: D.accentSoft,
    },
    optionText: {
        fontSize: 14,
        color: D.text,
    },
    optionTextSelected: {
        color: D.accent,
        fontWeight: '600',
    },
});

// ─── Summary Row Component ────────────────────────────────────────────────────
const SummaryRow = ({
    icon,
    label,
    value,
    accent = false,
    isLast = false,
}: {
    icon: string;
    label: string;
    value: string;
    accent?: boolean;
    isLast?: boolean;
}) => (
    <View style={[summaryStyles.row, isLast && summaryStyles.rowLast]}>
        <View style={summaryStyles.left}>
            <View style={summaryStyles.iconWrap}>
                <Ionicons name={icon as any} size={14} color={D.accent} />
            </View>
            <Text style={summaryStyles.label}>{label}</Text>
        </View>
        <Text style={[summaryStyles.value, accent && summaryStyles.valueAccent]}>{value}</Text>
    </View>
);

const summaryStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: D.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 13,
        color: D.textSub,
    },
    value: {
        fontSize: 13,
        fontWeight: '700',
        color: D.text,
    },
    valueAccent: {
        color: D.accent,
    },
});

// ─── Main Screen Component ────────────────────────────────────────────────────
const CreateGroupScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [emailInput, setEmailInput] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    const [form, setForm] = useState<FormState>({
        title: '',
        total_users: '',
        target_amount: '',
        expected_start_date: '',
        contribution_frequency: '',
        payment_out_day: '',
        payment_out_weekday: '',
        members_emails: [],
    });

    // Calculate payable amount
    const payable = form.total_users && form.target_amount
        ? (parseFloat(form.target_amount) / parseInt(form.total_users)).toFixed(2)
        : null;

    // Fetch user email on mount
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userData = await AsyncStorage.getItem('user');
                if (!userData) {
                    navigation.navigate('Signin');
                    return;
                }
                const parsed = JSON.parse(userData);
                if (parsed?.email) {
                    setUserEmail(parsed.email);
                }
            } catch (error) {
                // Silent fail for user data fetch
            }
        };
        fetchUserData();
    }, [navigation]);

    // Update form field
    const updateField = (key: keyof FormState, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
        // Clear error for this field
        if (errors[key]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    // Step validation
    const validateStep = (): boolean => {
        const newErrors: FormErrors = {};

        if (step === 1) {
            if (!form.title.trim()) newErrors.title = 'Group name is required';
            if (!form.total_users) newErrors.total_users = 'Number of members is required';
            else if (parseInt(form.total_users) < 2) newErrors.total_users = 'Minimum 2 members required';
            else if (parseInt(form.total_users) > 300) newErrors.total_users = 'Maximum 300 members allowed';
            if (!form.target_amount) newErrors.target_amount = 'Target amount is required';
            else if (parseFloat(form.target_amount) < 0) newErrors.target_amount = 'Must be £0 or more';
        }

        if (step === 2) {
            if (!form.expected_start_date) newErrors.expected_start_date = 'Start date is required';
            if (!form.contribution_frequency) newErrors.contribution_frequency = 'Contribution frequency is required';
            if (form.contribution_frequency === 'monthly' && !form.payment_out_day) {
                newErrors.payment_out_day = 'Payment day of month is required';
            }
            if (form.contribution_frequency === 'weekly' && form.payment_out_weekday === '') {
                newErrors.payment_out_weekday = 'Payment weekday is required';
            }
        }

        if (step === 3) {
            const needed = Math.max(0, parseInt(form.total_users) - 1);
            if (form.members_emails.length < needed) {
                newErrors.members_emails = `Add at least ${needed} member email${needed > 1 ? 's' : ''}`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Add email to list
    const addEmail = () => {
        const email = emailInput.trim().toLowerCase();
        if (!email) return;

        if (!isValidEmail(email)) {
            setErrors(prev => ({ ...prev, emailInput: 'Invalid email address' }));
            return;
        }
        if (form.members_emails.includes(email)) {
            setErrors(prev => ({ ...prev, emailInput: 'Email already added' }));
            return;
        }
        if (email === userEmail.toLowerCase()) {
            setErrors(prev => ({ ...prev, emailInput: 'Cannot add your own email' }));
            return;
        }
        const needed = parseInt(form.total_users) - 1;
        if (form.members_emails.length >= needed) {
            setErrors(prev => ({ ...prev, emailInput: `Maximum ${needed} member(s)` }));
            return;
        }

        updateField('members_emails', [...form.members_emails, email]);
        setEmailInput('');
        setErrors(prev => {
            const next = { ...prev };
            delete next.emailInput;
            delete next.members_emails;
            return next;
        });
    };

    // Remove email from list
    const removeEmail = (index: number) => {
        updateField('members_emails', form.members_emails.filter((_, i) => i !== index));
    };

    // Navigate steps with animation
    const animateStep = (newStep: number) => {
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setStep(newStep);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    };

    const nextStep = () => {
        if (validateStep()) {
            animateStep(Math.min(4, step + 1));
        }
    };

    const prevStep = () => {
        setErrors({});
        animateStep(Math.max(1, step - 1));
    };

    // Submit form
    const handleSubmit = async () => {
        setIsSubmitting(true);

        try {
            const apiUrl = Constants.expoConfig?.extra?.apiUrl;
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                Dialog.show({
                    type: ALERT_TYPE.DANGER,
                    title: 'Authentication Error',
                    textBody: 'Please login again to continue',
                    button: 'Close',
                });
                navigation.navigate('Signin');
                return;
            }

            const payload = {
                title: form.title,
                total_users: parseInt(form.total_users),
                target_amount: parseFloat(form.target_amount),
                expected_start_date: form.expected_start_date,
                contribution_frequency: form.contribution_frequency,
                ...(form.contribution_frequency === 'monthly' && {
                    payment_out_day: parseInt(form.payment_out_day),
                }),
                ...(form.contribution_frequency === 'weekly' && {
                    payment_out_weekday: parseInt(form.payment_out_weekday),
                }),
                members_emails: form.members_emails,
            };

            const response = await fetch(`${apiUrl}/user/group/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle unauthorized (expired/invalid token)
                if (response.status === 401) {
                    await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiresAt']);
                    Dialog.show({
                        type: ALERT_TYPE.DANGER,
                        title: 'Session Expired',
                        textBody: 'Your session has expired. Please login again.',
                        button: 'Close',
                    });
                    navigation.navigate('Signin');
                    return;
                }

                Dialog.show({
                    type: ALERT_TYPE.DANGER,
                    title: 'Failed to create group',
                    textBody: data.message || 'An error occurred while creating the group.',
                    button: 'Close',
                });
                return;
            }

            setIsSuccess(true);
        } catch (error) {
            Dialog.show({
                type: ALERT_TYPE.DANGER,
                title: 'Network Error',
                textBody: error instanceof Error ? error.message : 'Unable to connect to the server',
                button: 'Close',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setForm({
            title: '',
            total_users: '',
            target_amount: '',
            expected_start_date: '',
            contribution_frequency: '',
            payment_out_day: '',
            payment_out_weekday: '',
            members_emails: [],
        });
        setStep(1);
        setIsSuccess(false);
        setErrors({});
        setEmailInput('');
    };

    // ─── Success Screen ───────────────────────────────────────────────────────
    if (isSuccess) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={D.bg} />
                <View style={styles.successContainer}>
                    <LinearGradient
                        colors={D.gradientSuccess}
                        style={styles.successIcon}
                    >
                        <Text style={{ fontSize: 34 }}>🎉</Text>
                    </LinearGradient>

                    <Text style={styles.successTitle}>Group Created!</Text>
                    <Text style={styles.successSubtitle}>
                        <Text style={{ color: D.accent, fontWeight: '700' }}>{form.title}</Text> is ready.
                    </Text>
                    <Text style={styles.successMuted}>
                        Invitations sent to {form.members_emails.length} member{form.members_emails.length !== 1 ? 's' : ''}.
                    </Text>

                    <View style={styles.successCard}>
                        <View style={styles.successRow}>
                            <Text style={styles.successLabel}>Target</Text>
                            <Text style={[styles.successValue, { color: D.accent }]}>
                                {formatCurrency(form.target_amount)}
                            </Text>
                        </View>
                        <View style={styles.successRow}>
                            <Text style={styles.successLabel}>Per {form.contribution_frequency || 'payment'}</Text>
                            <Text style={[styles.successValue, { color: D.accent }]}>
                                {formatCurrency(payable || 0)}
                            </Text>
                        </View>
                        <View style={[styles.successRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.successLabel}>Duration</Text>
                            <Text style={styles.successValue}>{form.total_users} payments</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.successButton}
                        onPress={() => navigation.navigate('Dashboard')}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={D.gradientAccent}
                            style={styles.gradientButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.buttonText}>Go to Dashboard</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.outlineButton}
                        onPress={resetForm}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.outlineButtonText}>Create Another Group</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ─── Main Form ────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={D.gradientHeader[0]} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <LinearGradient
                    colors={D.gradientHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.headerDecor1} />
                    <View style={styles.headerDecor2} />

                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Create Group</Text>
                    <Text style={styles.headerSubtitle}>Set up a new savings group and invite members</Text>
                </LinearGradient>

                {/* Step Indicator */}
                <View style={styles.stepContainer}>
                    <StepIndicator currentStep={step} />
                </View>

                {/* Form Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {/* ─── Step 1: Group Info ─── */}
                        {step === 1 && (
                            <View>
                                {/* Tip Card */}
                                <View style={styles.tipCard}>
                                    <Ionicons name="bulb-outline" size={18} color={D.accent} />
                                    <Text style={styles.tipText}>
                                        Give your group a clear name, set a savings target, and define how many members will contribute monthly.
                                    </Text>
                                </View>

                                <Field label="Group Name" icon="wallet-outline" error={errors.title}>
                                    <StyledInput
                                        value={form.title}
                                        onChangeText={(v) => updateField('title', v)}
                                        placeholder="e.g. House Saving, Holiday Fund…"
                                    />
                                </Field>

                                <Field label="Number of Members" icon="people-outline" hint="2–300" error={errors.total_users}>
                                    <SelectInput
                                        value={form.total_users}
                                        placeholder="Select total members…"
                                        options={[
                                            ...Array.from({ length: 299 }, (_, i) => ({
                                                value: String(i + 2),
                                                label: `${i + 2} members`,
                                            })),
                                        ]}
                                        onSelect={(v) => {
                                            updateField('total_users', v);
                                            updateField('members_emails', []);
                                        }}
                                    />
                                </Field>

                                <Field label="Target Amount" icon="cash-outline" error={errors.target_amount}>
                                    <StyledInput
                                        value={form.target_amount}
                                        onChangeText={(v) => updateField('target_amount', v)}
                                        placeholder="0.00"
                                        prefix="£"
                                        keyboardType="decimal-pad"
                                    />
                                </Field>

                                {/* Live Preview */}
                                {payable && (
                                    <View style={styles.previewCard}>
                                        <Text style={styles.previewTitle}>LIVE PREVIEW</Text>
                                        <View style={styles.previewRow}>
                                            <View style={styles.previewCol}>
                                                <Text style={styles.previewLabel}>Monthly Each</Text>
                                                <Text style={[styles.previewValue, { color: D.accent }]}>
                                                    {formatCurrency(payable)}
                                                </Text>
                                            </View>
                                            <View style={styles.previewDivider} />
                                            <View style={styles.previewCol}>
                                                <Text style={styles.previewLabel}>Duration</Text>
                                                <Text style={[styles.previewValue, { color: D.accent2 }]}>
                                                    {form.total_users} mo
                                                </Text>
                                            </View>
                                            <View style={styles.previewDivider} />
                                            <View style={styles.previewCol}>
                                                <Text style={styles.previewLabel}>Total</Text>
                                                <Text style={styles.previewValue}>
                                                    {formatCurrency(form.target_amount)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ─── Step 2: Schedule ─── */}
                        {step === 2 && (
                            <View>
                                <View style={styles.tipCard}>
                                    <Ionicons name="calendar-outline" size={18} color={D.accent} />
                                    <Text style={styles.tipText}>
                                        Choose when payments start, how often members contribute, and the specific day for collection.
                                    </Text>
                                </View>

                                <Field label="Expected Start Date" icon="calendar-outline" error={errors.expected_start_date}>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setShowDatePicker(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.dateButtonText,
                                            !form.expected_start_date && { color: D.textMuted },
                                        ]}>
                                            {form.expected_start_date
                                                ? new Date(form.expected_start_date).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                })
                                                : 'Select start date…'}
                                        </Text>
                                        <Ionicons name="calendar" size={18} color={D.textSub} />
                                    </TouchableOpacity>
                                </Field>

                                {/* iOS: spinner in a bottom-sheet modal; Android: native calendar dialog */}
                                {Platform.OS === 'ios' ? (
                                    <Modal
                                        visible={showDatePicker}
                                        transparent
                                        animationType="slide"
                                        onRequestClose={() => setShowDatePicker(false)}
                                    >
                                        <View style={styles.dateModalOverlay}>
                                            <View style={styles.dateModalSheet}>
                                                <View style={styles.dateModalHeader}>
                                                    <Text style={styles.dateModalTitle}>Select Start Date</Text>
                                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                                        <Text style={styles.dateModalDone}>Done</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <DateTimePicker
                                                    value={form.expected_start_date ? new Date(form.expected_start_date) : new Date()}
                                                    mode="date"
                                                    display="spinner"
                                                    minimumDate={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()}
                                                    textColor={D.text}
                                                    style={{ backgroundColor: D.surfaceHi }}
                                                    onChange={(_, date) => {
                                                        if (date) {
                                                            updateField('expected_start_date', date.toISOString().split('T')[0]);
                                                        }
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    </Modal>
                                ) : (
                                    showDatePicker && (
                                        <DateTimePicker
                                            value={form.expected_start_date ? new Date(form.expected_start_date) : new Date()}
                                            mode="date"
                                            display="default"
                                            minimumDate={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()}
                                            onChange={(_, date) => {
                                                setShowDatePicker(false);
                                                if (date) {
                                                    updateField('expected_start_date', date.toISOString().split('T')[0]);
                                                }
                                            }}
                                        />
                                    )
                                )}

                                <Field label="Contribution Frequency" icon="repeat-outline" error={errors.contribution_frequency}>
                                    <SelectInput
                                        value={form.contribution_frequency}
                                        placeholder="Select frequency…"
                                        options={FREQUENCY_OPTIONS}
                                        onSelect={(v) => {
                                            updateField('contribution_frequency', v);
                                            updateField('payment_out_day', '');
                                            updateField('payment_out_weekday', '');
                                        }}
                                    />
                                </Field>

                                {/* Monthly — day of month */}
                                {form.contribution_frequency === 'monthly' && (
                                    <Field label="Payment Day of Month" icon="time-outline" hint="1–31" error={errors.payment_out_day}>
                                        <SelectInput
                                            value={form.payment_out_day}
                                            placeholder="Select payment day…"
                                            options={Array.from({ length: 31 }, (_, i) => ({
                                                value: String(i + 1),
                                                label: `${getOrdinalSuffix(i + 1)} of each month`,
                                            }))}
                                            onSelect={(v) => updateField('payment_out_day', v)}
                                        />
                                    </Field>
                                )}

                                {/* Weekly — day of week */}
                                {form.contribution_frequency === 'weekly' && (
                                    <Field label="Payment Weekday" icon="today-outline" error={errors.payment_out_weekday}>
                                        <SelectInput
                                            value={form.payment_out_weekday}
                                            placeholder="Select weekday…"
                                            options={WEEKDAYS.map((day, i) => ({ value: String(i), label: day }))}
                                            onSelect={(v) => updateField('payment_out_weekday', v)}
                                        />
                                    </Field>
                                )}

                                {/* Schedule Preview */}
                                {form.expected_start_date && form.contribution_frequency && (
                                    form.contribution_frequency === 'daily' ||
                                    (form.contribution_frequency === 'monthly' && !!form.payment_out_day) ||
                                    (form.contribution_frequency === 'weekly' && form.payment_out_weekday !== '')
                                ) && (() => {
                                    const previewCount = Math.min(3, parseInt(form.total_users) || 3);
                                    const dates = getScheduleDates(
                                        form.expected_start_date,
                                        form.contribution_frequency,
                                        form.payment_out_day,
                                        form.payment_out_weekday,
                                        previewCount,
                                    );
                                    const totalPayments = parseInt(form.total_users) || 0;
                                    return (
                                        <View style={styles.previewCard}>
                                            <Text style={styles.previewTitle}>SCHEDULE PREVIEW</Text>
                                            {dates.map((date, i) => (
                                                <View key={i} style={styles.scheduleRow}>
                                                    <View style={[
                                                        styles.scheduleNum,
                                                        i === 0 && styles.scheduleNumActive,
                                                    ]}>
                                                        <Text style={[
                                                            styles.scheduleNumText,
                                                            i === 0 && styles.scheduleNumTextActive,
                                                        ]}>
                                                            {i + 1}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.scheduleDate}>
                                                            {date.toLocaleDateString('en-GB', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric',
                                                            })}
                                                        </Text>
                                                        <Text style={styles.scheduleSub}>
                                                            Payment {i + 1} — {formatCurrency(payable || 0)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                            {totalPayments > 3 && (
                                                <Text style={styles.scheduleMore}>
                                                    + {totalPayments - 3} more payment{totalPayments - 3 > 1 ? 's' : ''}…
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })()}
                            </View>
                        )}

                        {/* ─── Step 3: Invite Members ─── */}
                        {step === 3 && (
                            <View>
                                <View style={styles.tipCard}>
                                    <Ionicons name="people-outline" size={18} color={D.accent} />
                                    <Text style={styles.tipText}>
                                        Invite <Text style={{ color: D.accent, fontWeight: '700' }}>
                                            {parseInt(form.total_users) - 1}
                                        </Text> member{parseInt(form.total_users) - 1 > 1 ? 's' : ''} to{' '}
                                        <Text style={{ fontWeight: '700' }}>{form.title}</Text>.
                                        They'll receive an email invitation to join.
                                    </Text>
                                </View>

                                {/* Slots Overview */}
                                <View style={styles.slotsContainer}>
                                    {Array.from({ length: parseInt(form.total_users) - 1 || 0 }).map((_, i) => {
                                        const filled = form.members_emails[i];
                                        return (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.slot,
                                                    filled && styles.slotFilled,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={filled ? 'checkmark-circle' : 'ellipse-outline'}
                                                    size={14}
                                                    color={filled ? D.accent2 : D.textMuted}
                                                />
                                                <Text
                                                    style={[styles.slotText, filled && styles.slotTextFilled]}
                                                    numberOfLines={1}
                                                >
                                                    {filled || `Slot ${i + 1}`}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                {/* Email Input */}
                                <Field
                                    label="Member Email"
                                    icon="mail-outline"
                                    error={errors.emailInput || errors.members_emails}
                                >
                                    <View style={styles.emailInputRow}>
                                        <View style={{ flex: 1 }}>
                                            <StyledInput
                                                value={emailInput}
                                                onChangeText={(v) => {
                                                    setEmailInput(v);
                                                    if (errors.emailInput) {
                                                        setErrors(prev => {
                                                            const next = { ...prev };
                                                            delete next.emailInput;
                                                            return next;
                                                        });
                                                    }
                                                }}
                                                placeholder="email@example.com"
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.addButton}
                                            onPress={addEmail}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={D.gradientAccent}
                                                style={styles.addButtonGradient}
                                            >
                                                <Ionicons name="add" size={24} color="#fff" />
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                </Field>

                                {/* Added Emails */}
                                {form.members_emails.length > 0 && (
                                    <View style={styles.emailList}>
                                        {form.members_emails.map((email, i) => (
                                            <View key={i} style={styles.emailItem}>
                                                <View style={styles.emailAvatar}>
                                                    <Text style={styles.emailAvatarText}>
                                                        {email[0].toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={styles.emailText} numberOfLines={1}>
                                                    {email}
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.removeButton}
                                                    onPress={() => removeEmail(i)}
                                                >
                                                    <Text style={styles.removeButtonText}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Progress */}
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressTrack}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${(form.members_emails.length / Math.max(1, parseInt(form.total_users) - 1)) * 100}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {form.members_emails.length} / {parseInt(form.total_users) - 1} invited
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* ─── Step 4: Review ─── */}
                        {step === 4 && (
                            <View>
                                <View style={[styles.tipCard, { backgroundColor: 'rgba(56, 217, 169, 0.08)' }]}>
                                    <Ionicons name="search-outline" size={18} color={D.accent2} />
                                    <Text style={styles.tipText}>
                                        Review everything before creating your group. Once confirmed, invitations will be sent automatically.
                                    </Text>
                                </View>

                                {/* Group Summary */}
                                <View style={styles.reviewCard}>
                                    <Text style={styles.reviewCardLabel}>GROUP</Text>
                                    <Text style={styles.reviewCardTitle}>{form.title}</Text>

                                    <SummaryRow icon="cash-outline" label="Target Amount" value={formatCurrency(form.target_amount)} accent />
                                    <SummaryRow icon="wallet-outline" label="Monthly Each" value={formatCurrency(payable || 0)} />
                                    <SummaryRow icon="people-outline" label="Total Members" value={`${form.total_users} people`} />
                                    <SummaryRow icon="calendar-outline" label="Duration" value={`${form.total_users} months`} />
                                    <SummaryRow
                                        icon="today-outline"
                                        label="Start Date"
                                        value={new Date(form.expected_start_date).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    />
                                    <SummaryRow
                                        icon="repeat-outline"
                                        label="Frequency"
                                        value={form.contribution_frequency.charAt(0).toUpperCase() + form.contribution_frequency.slice(1)}
                                        isLast={form.contribution_frequency === 'daily'}
                                    />
                                    {form.contribution_frequency === 'monthly' && (
                                        <SummaryRow
                                            icon="time-outline"
                                            label="Payment Day"
                                            value={`${getOrdinalSuffix(parseInt(form.payment_out_day))} of the month`}
                                            isLast
                                        />
                                    )}
                                    {form.contribution_frequency === 'weekly' && (
                                        <SummaryRow
                                            icon="today-outline"
                                            label="Payment Day"
                                            value={`Every ${WEEKDAYS[parseInt(form.payment_out_weekday)]}`}
                                            isLast
                                        />
                                    )}
                                </View>

                                {/* Members Summary */}
                                <View style={styles.reviewCard}>
                                    <Text style={styles.reviewCardLabel}>
                                        INVITED MEMBERS ({form.members_emails.length})
                                    </Text>
                                    {form.members_emails.map((email, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.memberReviewRow,
                                                i === form.members_emails.length - 1 && { borderBottomWidth: 0 },
                                            ]}
                                        >
                                            <View style={styles.memberReviewAvatar}>
                                                <Text style={styles.memberReviewAvatarText}>
                                                    {email[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.memberReviewEmail}>{email}</Text>
                                                <Text style={styles.memberReviewStatus}>Invitation pending</Text>
                                            </View>
                                            <View style={styles.pendingBadge}>
                                                <Text style={styles.pendingBadgeText}>PENDING</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Navigation Buttons */}
                        <View style={styles.buttonRow}>
                            {step > 1 && (
                                <TouchableOpacity
                                    style={styles.backStepButton}
                                    onPress={prevStep}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.backStepButtonText}>← Back</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.nextButton, step === 1 && { flex: 1 }]}
                                onPress={step < 4 ? nextStep : handleSubmit}
                                disabled={isSubmitting}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={step === 4 ? D.gradientSuccess : D.gradientAccent}
                                    style={styles.gradientButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {step === 4 ? '🚀 Create Group' : 'Continue →'}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Step Counter */}
                        <Text style={styles.stepCounter}>Step {step} of {STEPS.length}</Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: D.bg,
    },
    header: {
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 28,
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
    stepContainer: {
        paddingTop: 24,
        paddingHorizontal: 10,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: D.accentSoft,
        borderWidth: 1,
        borderColor: 'rgba(124, 140, 255, 0.15)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 24,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: D.textSub,
        lineHeight: 20,
    },
    previewCard: {
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 14,
        padding: 16,
        marginTop: 8,
    },
    previewTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: D.textMuted,
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    previewCol: {
        flex: 1,
        alignItems: 'center',
    },
    previewDivider: {
        width: 1,
        backgroundColor: D.border,
    },
    previewLabel: {
        fontSize: 11,
        color: D.textMuted,
        marginBottom: 4,
    },
    previewValue: {
        fontSize: 18,
        fontWeight: '800',
        color: D.text,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    dateButtonText: {
        fontSize: 15,
        color: D.text,
    },
    scheduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    scheduleNum: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5,
        borderColor: D.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scheduleNumActive: {
        backgroundColor: D.accentMed,
        borderColor: D.accent,
    },
    scheduleNumText: {
        fontSize: 11,
        fontWeight: '700',
        color: D.textMuted,
    },
    scheduleNumTextActive: {
        color: D.accent,
    },
    scheduleDate: {
        fontSize: 13,
        fontWeight: '600',
        color: D.text,
    },
    scheduleSub: {
        fontSize: 11,
        color: D.textMuted,
        marginTop: 2,
    },
    scheduleMore: {
        fontSize: 11,
        color: D.textMuted,
        textAlign: 'center',
        marginTop: 4,
    },
    slotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    slot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: D.surfaceHi,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minWidth: (SCREEN_WIDTH - 56) / 2,
        maxWidth: (SCREEN_WIDTH - 56) / 2,
    },
    slotFilled: {
        backgroundColor: D.accent2Soft,
        borderColor: 'rgba(56, 217, 169, 0.3)',
    },
    slotText: {
        flex: 1,
        fontSize: 11,
        color: D.textMuted,
    },
    slotTextFilled: {
        color: D.accent2,
    },
    emailInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    addButtonGradient: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emailList: {
        gap: 10,
        marginTop: 8,
    },
    emailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    emailAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: D.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emailAvatarText: {
        fontSize: 13,
        fontWeight: '700',
        color: D.accent,
    },
    emailText: {
        flex: 1,
        fontSize: 13,
        color: D.text,
    },
    removeButton: {
        backgroundColor: D.dangerSoft,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.2)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    removeButtonText: {
        fontSize: 12,
        color: D.danger,
        fontWeight: '600',
    },
    progressContainer: {
        marginTop: 16,
    },
    progressTrack: {
        height: 6,
        backgroundColor: D.surfaceHi,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: D.accent,
        borderRadius: 3,
    },
    progressText: {
        fontSize: 11,
        color: D.textMuted,
        textAlign: 'right',
        marginTop: 6,
    },
    reviewCard: {
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
    },
    reviewCardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: D.textMuted,
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    reviewCardTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: D.text,
        marginBottom: 16,
    },
    memberReviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    memberReviewAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: D.accentSoft,
        borderWidth: 1,
        borderColor: 'rgba(124, 140, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberReviewAvatarText: {
        fontSize: 13,
        fontWeight: '700',
        color: D.accent,
    },
    memberReviewEmail: {
        fontSize: 13,
        fontWeight: '600',
        color: D.text,
    },
    memberReviewStatus: {
        fontSize: 11,
        color: D.textMuted,
        marginTop: 2,
    },
    pendingBadge: {
        backgroundColor: D.warnSoft,
        borderWidth: 1,
        borderColor: 'rgba(255, 169, 77, 0.15)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    pendingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: D.warn,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 28,
    },
    backStepButton: {
        flex: 1,
        height: 52,
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backStepButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: D.textSub,
    },
    nextButton: {
        flex: 2,
        borderRadius: 14,
        overflow: 'hidden',
    },
    gradientButton: {
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    stepCounter: {
        fontSize: 12,
        color: D.textMuted,
        textAlign: 'center',
        marginTop: 14,
    },
    // Date picker modal (iOS)
    dateModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    dateModalSheet: {
        backgroundColor: D.surfaceHi,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 30,
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    dateModalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: D.text,
    },
    dateModalDone: {
        fontSize: 15,
        fontWeight: '700',
        color: D.accent,
    },
    // Success styles
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: D.text,
        marginBottom: 10,
    },
    successSubtitle: {
        fontSize: 14,
        color: D.textSub,
        textAlign: 'center',
        marginBottom: 8,
    },
    successMuted: {
        fontSize: 13,
        color: D.textMuted,
        textAlign: 'center',
        marginBottom: 30,
    },
    successCard: {
        backgroundColor: D.surface,
        borderRadius: 16,
        padding: 18,
        width: '100%',
        borderWidth: 1,
        borderColor: D.border,
        marginBottom: 24,
    },
    successRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: D.border,
    },
    successLabel: {
        fontSize: 13,
        color: D.textSub,
    },
    successValue: {
        fontSize: 13,
        fontWeight: '700',
        color: D.text,
    },
    successButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
    },
    outlineButton: {
        width: '100%',
        height: 52,
        borderWidth: 1.5,
        borderColor: D.border,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outlineButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: D.textSub,
    },
});

export default CreateGroupScreen;
