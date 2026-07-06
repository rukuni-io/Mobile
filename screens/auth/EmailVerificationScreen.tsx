import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import { ALERT_TYPE, Dialog } from 'react-native-alert-notification';
import { Ionicons } from '@expo/vector-icons';
import { D } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import OTPInput from '../../components/OTPInput';

type RootStackParamList = {
  EmailVerification: { email: string };
  Signin: undefined;
};

type EmailVerificationRouteProp = RouteProp<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<EmailVerificationRouteProp>();

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const email = route.params?.email || '';
  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // ── Verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }
    setOtpError('');
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
      Dialog.show({
        type: ALERT_TYPE.SUCCESS,
        title: 'Success',
        textBody: 'Email verified successfully!',
        button: 'OK',
        onHide: () => {
          navigation.navigate('Signin');
        },
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid or expired code.';
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend Verification Code ──
  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/resend-verification`, { email });
      Dialog.show({
        type: ALERT_TYPE.SUCCESS,
        title: 'Success',
        textBody: 'Verification code sent to your email.',
        button: 'OK',
      });
      setResendCountdown(60); // 60 second cooldown
      setOtp('');
      setOtpError('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to resend code. Please try again.';
      Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Error', textBody: msg, button: 'OK' });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#003f5c" />
        <LinearGradient colors={['#003f5c', '#1c3c5c']} style={styles.container}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/logos/RUKUNI-LOGO-mobile-18.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit code to{'\n'}
                <Text style={styles.email}>{email}</Text>
              </Text>

              {/* OTP Input */}
              <View style={styles.otpContainer}>
                <OTPInput value={otp} onChangeText={setOtp} editable={!loading} />
                {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
              </View>

              {/* Verify Button */}
              <PrimaryButton
                title={loading ? 'Verifying...' : 'Verify'}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                style={styles.button}
              />

              {/* Resend Code Section */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resendLoading || resendCountdown > 0}
                  style={[
                    styles.resendButton,
                    (resendLoading || resendCountdown > 0) && styles.resendButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.resendButtonText,
                      (resendLoading || resendCountdown > 0) && styles.resendButtonTextDisabled,
                    ]}
                  >
                    {resendCountdown > 0
                      ? `Resend in ${resendCountdown}s`
                      : resendLoading
                      ? 'Sending...'
                      : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Back to Sign In */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Signin')}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.backButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#a3c9e3',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  email: {
    fontWeight: '600',
    color: '#fff',
  },
  otpContainer: {
    marginVertical: 24,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    marginBottom: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  resendText: {
    color: '#a3c9e3',
    fontSize: 14,
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a90c7',
  },
  resendButtonDisabled: {
    borderColor: '#666',
  },
  resendButtonText: {
    color: '#2a90c7',
    fontSize: 14,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#666',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
