import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import Constants from 'expo-constants';
import { D } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────
type RootStackParamList = {
    Dashboard:  undefined;
    Referral:   undefined;
    Settings:   undefined;
};

interface UserData {
    name?:               string;
    email?:              string;
    mobile?:             string;
    status?:             string;
    email_verified_at?:  string;
    created_at?:         string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (n?: string) =>
    (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

// ─── Sub-Components ───────────────────────────────────────────────────────────
const SecLabel: React.FC<{ text: string }> = ({ text }) => (
    <Text style={styles.sectionLabel}>{text}</Text>
);

const InfoRow: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    valueColor?: string;
    onPress?: () => void;
    last?: boolean;
}> = ({ icon, label, value, valueColor, onPress, last }) => (
    <TouchableOpacity
        style={[styles.infoRow, last && styles.infoRowLast]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
    >
        <View style={styles.infoIconWrap}>
            <Ionicons name={icon} size={17} color={D.accent} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoRight}>
            {value ? (
                <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>
                    {value}
                </Text>
            ) : null}
            {onPress && (
                <Ionicons name="chevron-forward" size={14} color={D.textMuted} style={{ marginLeft: 4 }} />
            )}
        </View>
    </TouchableOpacity>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
const ProfileScreen: React.FC = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const apiUrl = Constants.expoConfig?.extra?.apiUrl || '';

    const [user, setUser]       = useState<UserData>({});
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [name, setName]       = useState('');
    const [mobile, setMobile]   = useState('');

    // Password change state
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordLoading, setPasswordLoading]   = useState(false);
    const [currentPassword, setCurrentPassword]   = useState('');
    const [newPassword, setNewPassword]           = useState('');
    const [confirmPassword, setConfirmPassword]   = useState('');
    const [passwordErrors, setPasswordErrors]     = useState<{ current?: string; new?: string; confirm?: string }>({});

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('user');
                if (raw) {
                    const parsed: UserData = JSON.parse(raw);
                    setUser(parsed);
                    setName(parsed.name ?? '');
                    setMobile(parsed.mobile ?? '');
                }
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = useCallback(async () => {
        const updated = { ...user, name, mobile };
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setEditing(false);
        Toast.show({ type: 'success', text1: 'Profile updated successfully' });
    }, [user, name, mobile]);

    const resetPasswordForm = useCallback(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordErrors({});
        setChangingPassword(false);
    }, []);

    const handleChangePassword = useCallback(async () => {
        // Validate
        const errors: typeof passwordErrors = {};
        if (!currentPassword) errors.current = 'Current password is required';
        if (!newPassword) errors.new = 'New password is required';
        else if (newPassword.length < 8) errors.new = 'Password must be at least 8 characters';
        if (!confirmPassword) errors.confirm = 'Please confirm your password';
        else if (newPassword !== confirmPassword) errors.confirm = 'Passwords do not match';

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setPasswordErrors({});
        setPasswordLoading(true);

        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(
                `${apiUrl}/user/change-password`,
                {
                    current_password: currentPassword,
                    password: newPassword,
                    password_confirmation: confirmPassword,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'success', text1: 'Password changed successfully' });
            resetPasswordForm();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to change password';
            if (msg.toLowerCase().includes('current')) {
                setPasswordErrors({ current: msg });
            } else {
                Toast.show({ type: 'error', text1: msg });
            }
        } finally {
            setPasswordLoading(false);
        }
    }, [apiUrl, currentPassword, newPassword, confirmPassword, resetPasswordForm]);

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={D.accent} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                {/* ── Header ── */}
                <LinearGradient
                    colors={['#3d4fc7', '#6a3fa5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <SafeAreaView>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={16} color="#fff" />
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                        <View style={styles.avatarSection}>
                            <View style={styles.avatarOuter}>
                                <LinearGradient
                                    colors={['#7c8cff', '#c084fc']}
                                    style={styles.avatar}
                                >
                                    <Text style={styles.avatarText}>{initials(name)}</Text>
                                </LinearGradient>
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark" size={11} color="#fff" />
                                </View>
                            </View>
                            <Text style={styles.headerName}>{name || 'User'}</Text>
                            <Text style={styles.headerEmail}>{user.email}</Text>
                            <View style={styles.statusPill}>
                                <Text style={styles.statusPillText}>
                                    {(user.status ?? 'active').toUpperCase()} MEMBER
                                </Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.body}>
                    {/* ── Personal Info ── */}
                    <SecLabel text="Personal Information" />
                    <View style={styles.card}>
                        {editing ? (
                            <View style={styles.editForm}>
                                {[
                                    { label: 'Full Name', value: name,   setValue: setName },
                                    { label: 'Mobile',    value: mobile, setValue: setMobile },
                                ].map(f => (
                                    <View key={f.label} style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>{f.label}</Text>
                                        <TextInput
                                            value={f.value}
                                            onChangeText={f.setValue}
                                            style={styles.input}
                                            placeholderTextColor={D.textMuted}
                                        />
                                    </View>
                                ))}
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() => setEditing(false)}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveBtn}
                                        onPress={handleSave}
                                    >
                                        <LinearGradient
                                            colors={['#7c8cff', '#9b59d4']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.saveBtnGrad}
                                        >
                                            <Text style={styles.saveBtnText}>Save Changes</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <InfoRow icon="person-outline"      label="Full Name"     value={name} />
                                <InfoRow icon="mail-outline"        label="Email"         value={user.email} />
                                <InfoRow icon="call-outline"        label="Mobile"        value={mobile || '—'} />
                                <InfoRow icon="calendar-outline"    label="Member Since"  value={fmtDate(user.created_at)} />
                                <InfoRow icon="checkmark-circle-outline" label="Email Verified" value="Verified" valueColor={D.accent2} last />
                            </>
                        )}
                    </View>

                    {!editing && (
                        <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditing(true)}>
                            <LinearGradient
                                colors={['#7c8cff', '#9b59d4']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.editProfileGrad}
                            >
                                <Ionicons name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.editProfileText}>Edit Profile</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* ── Quick Actions ── */}
                    <SecLabel text="Quick Actions" />
                    <View style={styles.card}>
                        <InfoRow
                            icon="gift-outline"
                            label="Referral Programme"
                            onPress={() => navigation.navigate('Referral')}
                        />
                        <InfoRow
                            icon="settings-outline"
                            label="Settings"
                            onPress={() => navigation.navigate('Settings')}
                            last
                        />
                    </View>

                    {/* ── Security ── */}
                    <SecLabel text="Security" />
                    <View style={styles.card}>
                        {changingPassword ? (
                            <View style={styles.editForm}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Current Password</Text>
                                    <TextInput
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        style={[styles.input, passwordErrors.current && styles.inputError]}
                                        placeholderTextColor={D.textMuted}
                                        placeholder="Enter current password"
                                        secureTextEntry
                                    />
                                    {passwordErrors.current && (
                                        <Text style={styles.errorText}>{passwordErrors.current}</Text>
                                    )}
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>New Password</Text>
                                    <TextInput
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        style={[styles.input, passwordErrors.new && styles.inputError]}
                                        placeholderTextColor={D.textMuted}
                                        placeholder="Enter new password"
                                        secureTextEntry
                                    />
                                    {passwordErrors.new && (
                                        <Text style={styles.errorText}>{passwordErrors.new}</Text>
                                    )}
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                                    <TextInput
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        style={[styles.input, passwordErrors.confirm && styles.inputError]}
                                        placeholderTextColor={D.textMuted}
                                        placeholder="Confirm new password"
                                        secureTextEntry
                                    />
                                    {passwordErrors.confirm && (
                                        <Text style={styles.errorText}>{passwordErrors.confirm}</Text>
                                    )}
                                </View>
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={resetPasswordForm}
                                        disabled={passwordLoading}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveBtn}
                                        onPress={handleChangePassword}
                                        disabled={passwordLoading}
                                    >
                                        <LinearGradient
                                            colors={['#7c8cff', '#9b59d4']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.saveBtnGrad}
                                        >
                                            {passwordLoading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={styles.saveBtnText}>Update Password</Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <InfoRow
                                    icon="key-outline"
                                    label="Change Password"
                                    onPress={() => setChangingPassword(true)}
                                />
                                <InfoRow
                                    icon="phone-portrait-outline"
                                    label="Two-Factor Auth"
                                    value="OFF"
                                    valueColor={D.warn}
                                    onPress={() => Toast.show({ type: 'info', text1: '2FA coming soon' })}
                                    last
                                />
                            </>
                        )}
                    </View>

                    {/* ── Account ── */}
                    <SecLabel text="Account" />
                    <View style={styles.card}>
                        <InfoRow
                            icon="log-out-outline"
                            label="Sign Out"
                            valueColor={D.danger}
                            onPress={() => Toast.show({ type: 'info', text1: 'Signed out' })}
                            last
                        />
                    </View>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: D.bg,
    },
    scroll: { flex: 1 },
    loadingWrap: {
        flex: 1, backgroundColor: D.bg, alignItems: 'center', justifyContent: 'center',
    },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginBottom: 20,
    },
    backBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    avatarSection:  { alignItems: 'center' },
    avatarOuter: { position: 'relative', marginBottom: 12 },
    avatar: {
        width: 84, height: 84, borderRadius: 42,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
    },
    avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
    verifiedBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: '#38d9a9',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#3d4fc7',
    },
    headerName:  { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
    headerEmail: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 12 },
    statusPill: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 4,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    },
    statusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    // Body
    body: { paddingHorizontal: 16, paddingTop: 20 },

    // Section label
    sectionLabel: {
        fontSize: 10, fontWeight: '700', color: D.textMuted,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginTop: 20, marginBottom: 10,
    },

    // Card
    card: {
        backgroundColor: D.surface,
        borderRadius: 18, borderWidth: 1, borderColor: D.border,
        paddingHorizontal: 18, paddingVertical: 4,
        marginBottom: 4,
    },

    // Info Row
    infoRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 13,
        borderBottomWidth: 1, borderBottomColor: D.border,
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoIconWrap: {
        width: 36, height: 36, borderRadius: 11,
        backgroundColor: D.accentSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    infoLabel: { flex: 1, fontSize: 14, color: D.textSub, fontWeight: '500' },
    infoRight:  { flexDirection: 'row', alignItems: 'center' },
    infoValue:  { fontSize: 14, fontWeight: '700', color: D.text },

    // Edit form
    editForm: { paddingVertical: 8, gap: 14 },
    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 12, color: D.textMuted },
    input: {
        backgroundColor: D.surfaceHi,
        borderWidth: 1.5, borderColor: D.accent,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        color: D.text, fontSize: 14,
    },
    editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
        flex: 1, borderWidth: 1, borderColor: D.border,
        borderRadius: 12, paddingVertical: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtnText: { color: D.textSub, fontWeight: '700', fontSize: 14 },
    saveBtn: { flex: 2, borderRadius: 12, overflow: 'hidden' },
    saveBtnGrad: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    inputError: { borderColor: D.danger },
    errorText: { color: D.danger, fontSize: 12, marginTop: 4 },

    // Edit profile button
    editProfileBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 4, marginTop: 8 },
    editProfileGrad: {
        paddingVertical: 14, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
    },
    editProfileText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ProfileScreen;
