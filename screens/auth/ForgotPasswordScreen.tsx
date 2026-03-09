import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import Constants from 'expo-constants';
import { ALERT_TYPE, Dialog } from 'react-native-alert-notification';
import { Ionicons } from '@expo/vector-icons';
import { D } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import OTPInput from '../../components/OTPInput';
import StepDots from '../../components/StepDots';

type RootStackParamList = {
  ForgotPassword: undefined;
  Signin: undefined;
};

type Step = 0 | 1 | 2; // Email → OTP → New Password

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  // Step 0
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Step 1
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  // Step 2
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');

  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;

  // ── Step 0: request reset ──
  const handleRequestReset = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/forgot-password`, { email });
      setStep(1);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to send reset code.';
      Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Error', textBody: msg, button: 'OK' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }
    setOtpError('');
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid or expired code.';
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: set new password ──
  const handleSetPassword = async () => {
    if (password.length < 6) {
      setPwError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwError('');
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/reset-password`, { email, otp, password, password_confirmation: confirm });
      Dialog.show({
        type: ALERT_TYPE.SUCCESS,
        title: 'Password Updated',
        textBody: 'You can now sign in with your new password.',
        button: 'Sign In',
      });
      navigation.navigate('Signin');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update password.';
      setPwError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setOtp('');
    await handleRequestReset();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Header gradient strip */}
      <LinearGradient colors={['#1a1f3e', D.bg]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={D.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 0 ? 'Forgot Password' : step === 1 ? 'Verify Code' : 'New Password'}
        </Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        <StepDots total={3} current={step} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 0: Email ── */}
          {step === 0 && (
            <>
              <View style={styles.illustrationRow}>
                <LinearGradient colors={['#1e2240', '#2a2f5c']} style={styles.illusCircle}>
                  <Text style={styles.illusEmoji}>🔒</Text>
                </LinearGradient>
              </View>
              <Text style={styles.stepTitle}>Reset your password</Text>
              <Text style={styles.stepSubtitle}>
                Enter the email address linked to your account and we'll send you a reset code.
              </Text>

              <FloatingLabelInput
                label="Email address"
                value={email}
                onChangeText={setEmail}
                iconName="mail-outline"
                keyboardType="email-address"
                error={emailError}
              />

              <PrimaryButton
                label="Send Reset Code"
                onPress={handleRequestReset}
                loading={loading}
              />
            </>
          )}

          {/* ── Step 1: OTP ── */}
          {step === 1 && (
            <>
              <View style={styles.illustrationRow}>
                <LinearGradient colors={['#0f2a27', '#1a3e3a']} style={styles.illusCircle}>
                  <Text style={styles.illusEmoji}>📨</Text>
                </LinearGradient>
              </View>
              <Text style={styles.stepTitle}>Enter the code</Text>
              <Text style={styles.stepSubtitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.emailHighlight}>{email}</Text>.{' '}
                Check your inbox.
              </Text>

              <OTPInput value={otp} onChange={setOtp} />
              {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

              <View style={{ height: 24 }} />
              <PrimaryButton label="Verify Code" onPress={handleVerifyOtp} loading={loading} />

              <TouchableOpacity onPress={resendOtp} style={styles.resendBtn}>
                <Text style={styles.resendText}>
                  Didn't receive it?{' '}
                  <Text style={styles.resendLink}>Resend</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: New Password ── */}
          {step === 2 && (
            <>
              <View style={styles.illustrationRow}>
                <LinearGradient colors={['#1e1630', '#2a2050']} style={styles.illusCircle}>
                  <Text style={styles.illusEmoji}>🔑</Text>
                </LinearGradient>
              </View>
              <Text style={styles.stepTitle}>Create new password</Text>
              <Text style={styles.stepSubtitle}>
                Choose a strong password you haven't used before.
              </Text>

              <FloatingLabelInput
                label="New password"
                value={password}
                onChangeText={setPassword}
                iconName="lock-closed-outline"
                secureTextEntry
                secureToggle
              />
              <FloatingLabelInput
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                iconName="lock-closed-outline"
                secureTextEntry
                secureToggle
                error={pwError}
              />

              <PrimaryButton label="Update Password" onPress={handleSetPassword} loading={loading} />
            </>
          )}

          {/* Back to sign in */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Signin')}
            style={styles.signinLink}
          >
            <Text style={styles.signinLinkText}>
              Back to{' '}
              <Text style={styles.signinLinkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  headerTitle: {
    color: D.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dotsRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  body: {
    paddingHorizontal: 28,
    paddingBottom: 50,
  },
  illustrationRow: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 10,
  },
  illusCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  illusEmoji: {
    fontSize: 52,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: D.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 14,
    color: D.textSecondary,
    lineHeight: 21,
    marginBottom: 28,
  },
  emailHighlight: {
    color: D.accent,
    fontWeight: '600',
  },
  errorText: {
    color: D.danger,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  resendBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    color: D.textMuted,
    fontSize: 14,
  },
  resendLink: {
    color: D.accent,
    fontWeight: '700',
  },
  signinLink: {
    marginTop: 28,
    alignItems: 'center',
  },
  signinLinkText: {
    color: D.textMuted,
    fontSize: 14,
  },
  signinLinkAccent: {
    color: D.accent,
    fontWeight: '700',
  },
});
