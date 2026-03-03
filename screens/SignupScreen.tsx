import React, { useState, useCallback, useRef } from 'react';
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
import axios from 'axios';
import { ALERT_TYPE, Dialog } from 'react-native-alert-notification';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Yup from 'yup';
import { D } from '../theme/tokens';
import PrimaryButton from '../components/PrimaryButton';
import FloatingLabelInput from '../components/FloatingLabelInput';
import StepDots from '../components/StepDots';

type RootStackParamList = {
  Signin: undefined;
  Signup: undefined;
};

// ── Validation schemas per step ──
const step1Schema = Yup.object({
  name: Yup.string().required('Full name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  mobile: Yup.string()
    .matches(/^[0-9]+$/, 'Mobile number must be digits')
    .min(10, 'Min 10 digits')
    .max(15, 'Max 15 digits')
    .required('Mobile number is required'),
});

const step2Schema = Yup.object({
  password: Yup.string().min(6, 'Min 6 characters').required('Password is required'),
  password_confirmation: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

type Step = 0 | 1 | 2;

function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // Form data carried across steps
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    password_confirmation: '',
    referralCode: '',
  });

  // Referral code validation state
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralError, setReferralError] = useState('');
  const [referralValidating, setReferralValidating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Step 0 / 1 field errors ──
  const [step1Errors, setStep1Errors] = useState<Partial<typeof formData>>({});
  const [step2Errors, setStep2Errors] = useState<Partial<typeof formData>>({});

  const apiUrl = Constants.expoConfig?.extra?.apiUrl || '';

  // ── Referral code validation ──
  const validateReferralCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      setReferralError('');
      setReferralValidating(false);
      return;
    }

    setReferralValidating(true);
    try {
      const response = await axios.post<{ success: boolean; message: string }>(`${apiUrl}/referral/validate`, { referral_code: code });
      // Check if API returns success field
      if (response.data?.success) {
        setReferralValid(true);
        setReferralError('');
      } else {
        setReferralValid(false);
        setReferralError(response.data?.message || 'Invalid referral code');
      }
    } catch (error: any) {
      console.log('Referral validation error:', error.response?.data || error.message);
      setReferralValid(false);
      setReferralError(error.response?.data?.message || 'Could not validate referral code');
    } finally {
      setReferralValidating(false);
    }
  }, [apiUrl]);

  const handleReferralChange = useCallback((val: string) => {
    setFormData(p => ({ ...p, referralCode: val }));
    setReferralValid(null);
    setReferralError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim()) {
      setReferralValidating(true);
      debounceRef.current = setTimeout(() => validateReferralCode(val), 500);
    }
  }, [validateReferralCode]);

  // ── Step 0 → 1 ──
  const handleStep1 = async () => {
    try {
      await step1Schema.validate(
        { name: formData.name, email: formData.email, mobile: formData.mobile },
        { abortEarly: false },
      );
      setStep1Errors({});
    } catch (err: any) {
      const errs: Partial<typeof formData> = {};
      err.inner?.forEach((e: any) => { errs[e.path as keyof typeof formData] = e.message; });
      setStep1Errors(errs);
      return;
    }

    // Check referral code validity if provided
    if (formData.referralCode.trim() && referralValid === false) {
      setReferralError('Please enter a valid referral code or leave it empty');
      return;
    }
    if (formData.referralCode.trim() && referralValidating) {
      setReferralError('Validating referral code, please wait...');
      return;
    }

    setStep(1);
  };

  // ── Step 1 → API register ──
  const handleStep2 = async () => {
    try {
      await step2Schema.validate(
        { password: formData.password, password_confirmation: formData.password_confirmation },
        { abortEarly: false },
      );
      setStep2Errors({});
    } catch (err: any) {
      const errs: Partial<typeof formData> = {};
      err.inner?.forEach((e: any) => { errs[e.path as keyof typeof formData] = e.message; });
      setStep2Errors(errs);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        ...(referralValid && formData.referralCode.trim() ? { referral_code: formData.referralCode.trim() } : {}),
      };
      
      console.log('=== REGISTRATION PAYLOAD ===');
      console.log('URL:', `${apiUrl}/auth/register`);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('============================');
      
      const response = await axios.post<{ message: string }>(`${apiUrl}/auth/register`, payload);
      console.log('Registration response:', {response, formData: { ...formData, referralCode: undefined }});
      if (response.status === 201) {
        setStep(2);
      } else {
        Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Registration Failed', textBody: response.data.message || 'Bad request.', button: 'Close' });
        console.log('Unexpected registration response:', response);
      }
    } catch (error: any) {
      console.log('=== REGISTRATION ERROR ===');
      console.log('Full error response:', JSON.stringify(error.response?.data, null, 2));
      console.log('Status:', error.response?.status);
      console.log('Validation errors:', error.response?.data?.errors);
      console.log('Message:', error.response?.data?.message);
      console.log('==========================');
      
      // Handle Laravel validation errors
      const validationErrors = error.response?.data?.errors;
      if (validationErrors && typeof validationErrors === 'object') {
        const step1Fields = ['name', 'email', 'mobile', 'referral_code'];
        const step2Fields = ['password', 'password_confirmation'];
        
        const newStep1Errors: Partial<typeof formData> = {};
        const newStep2Errors: Partial<typeof formData> = {};
        let hasStep1Errors = false;
        
        // Map Laravel validation errors to form fields
        Object.entries(validationErrors).forEach(([field, messages]) => {
          const errorMsg = Array.isArray(messages) ? messages[0] : String(messages);
          
          if (step1Fields.includes(field)) {
            // Map referral_code to referralCode
            const fieldKey = field === 'referral_code' ? 'referralCode' : field;
            newStep1Errors[fieldKey as keyof typeof formData] = errorMsg;
            hasStep1Errors = true;
          } else if (step2Fields.includes(field)) {
            newStep2Errors[field as keyof typeof formData] = errorMsg;
          }
        });
        
        // Update error states
        if (Object.keys(newStep1Errors).length > 0) {
          setStep1Errors(newStep1Errors);
        }
        if (Object.keys(newStep2Errors).length > 0) {
          setStep2Errors(newStep2Errors);
        }
        
        // Navigate back to step 0 if there are step 1 field errors
        if (hasStep1Errors) {
          setStep(0);
        }
        
        // Show a summary dialog
        const errorMessages = Object.values(validationErrors)
          .flat()
          .slice(0, 3) // Show max 3 errors
          .join('\n• ');
        Dialog.show({
          type: ALERT_TYPE.WARNING,
          title: 'Please fix the following',
          textBody: `• ${errorMessages}`,
          button: 'OK',
        });
      } else {
        // Generic error message
        const msg = error.response?.data?.message || error.message || 'An error occurred.';
        Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Registration Error', textBody: msg, button: 'Close' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend verification email ──
  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await axios.post(`${apiUrl}/auth/resend-verification`, { email: formData.email });
      setResendMessage('Verification email sent! Please check your inbox.');
      Dialog.show({
        type: ALERT_TYPE.SUCCESS,
        title: 'Email Sent',
        textBody: 'A new verification link has been sent to your email.',
        button: 'OK',
      });
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to resend verification email.';
      setResendMessage(msg);
      Dialog.show({
        type: ALERT_TYPE.DANGER,
        title: 'Error',
        textBody: msg,
        button: 'Close',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const updateField = (key: keyof typeof formData) => (val: string) =>
    setFormData(p => ({ ...p, [key]: val }));

  const stepTitles = ['Your info', 'Set password', 'Check your email'];
  const stepSubtitles = [
    'Tell us a bit about yourself',
    'Choose a secure password',
    'Verify your account to get started',
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Hero */}
      <LinearGradient colors={['#1a1f3e', D.bg]} style={styles.heroBanner}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <Text style={styles.heroEmoji}>✨</Text>
        <Text style={styles.appName}>GroupSave</Text>
        <Text style={styles.heroSubtitle}>Create your account</Text>
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
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>{stepTitles[step]}</Text>
          <Text style={styles.stepSubtitle}>{stepSubtitles[step]}</Text>

          {/* ── Step 0: Info ── */}
          {step === 0 && (
            <>
              <FloatingLabelInput
                label="Full name"
                value={formData.name}
                onChangeText={updateField('name')}
                iconName="person-outline"
                error={step1Errors.name}
              />
              <FloatingLabelInput
                label="Email address"
                value={formData.email}
                onChangeText={updateField('email')}
                iconName="mail-outline"
                keyboardType="email-address"
                error={step1Errors.email}
              />
              <FloatingLabelInput
                label="Mobile number"
                value={formData.mobile}
                onChangeText={updateField('mobile')}
                iconName="call-outline"
                keyboardType="phone-pad"
                error={step1Errors.mobile}
              />
              <FloatingLabelInput
                label="Referral code (optional)"
                value={formData.referralCode}
                onChangeText={handleReferralChange}
                iconName="gift-outline"
                error={referralError}
                autoCapitalize="characters"
              />
              {referralValidating && (
                <Text style={styles.referralValidating}>Validating...</Text>
              )}
              {referralValid && (
                <Text style={styles.referralValid}>✓ Valid referral code</Text>
              )}
              <PrimaryButton label="Continue" onPress={handleStep1} />
            </>
          )}

          {/* ── Step 1: Password ── */}
          {step === 1 && (
            <>
              <FloatingLabelInput
                label="Password"
                value={formData.password}
                onChangeText={updateField('password')}
                iconName="lock-closed-outline"
                secureTextEntry
                secureToggle
                error={step2Errors.password}
              />
              <FloatingLabelInput
                label="Confirm password"
                value={formData.password_confirmation}
                onChangeText={updateField('password_confirmation')}
                iconName="lock-closed-outline"
                secureTextEntry
                secureToggle
                error={step2Errors.password_confirmation}
              />
              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setStep(0)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <PrimaryButton
                  label="Create Account"
                  onPress={handleStep2}
                  loading={loading}
                  fullWidth={false}
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>
            </>
          )}

          {/* ── Step 2: Check Email ── */}
          {step === 2 && (
            <>
              <View style={styles.emailSentContainer}>
                <Text style={styles.emailIcon}>📧</Text>
                <Text style={styles.emailSentTitle}>Verification Link Sent!</Text>
                <Text style={styles.emailSentText}>
                  We've sent a verification link to{' '}
                  <Text style={styles.emailHighlight}>{formData.email}</Text>
                </Text>
                <Text style={styles.emailInstructions}>
                  Please check your inbox and click the link to verify your account. Don't forget to check your spam folder.
                </Text>
              </View>
              {resendMessage ? (
                <Text style={styles.resendMessage}>{resendMessage}</Text>
              ) : null}
              <View style={{ height: 16 }} />
              <PrimaryButton
                label="Resend Verification Email"
                onPress={handleResendVerification}
                loading={resendLoading}
              />
              <TouchableOpacity onPress={() => navigation.navigate('Signin')} style={styles.goToSigninBtn}>
                <Text style={styles.goToSigninText}>Go to Sign In</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.signinPrompt}>
            Already have an account?{' '}
            <Text style={styles.signinLink} onPress={() => navigation.navigate('Signin')}>
              Sign In
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default SignupScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  heroBanner: {
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: D.accentGlow,
    top: -60,
    right: -40,
  },
  circle2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0,200,150,0.07)',
    bottom: 0,
    left: -30,
  },
  heroEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: D.textPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: D.textSecondary,
    marginTop: 4,
  },
  dotsRow: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: D.bg,
  },
  card: {
    backgroundColor: D.surface,
    marginHorizontal: 20,
    borderRadius: D.radiusLg,
    padding: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: D.border,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: D.textPrimary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: D.textSecondary,
    marginBottom: 24,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  backBtn: {
    paddingVertical: 10,
    paddingRight: 8,
  },
  backBtnText: {
    color: D.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  emailSentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emailIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emailSentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: D.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emailSentText: {
    fontSize: 15,
    color: D.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailHighlight: {
    color: D.accent,
    fontWeight: '600',
  },
  emailInstructions: {
    fontSize: 13,
    color: D.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  resendMessage: {
    color: D.accent,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  goToSigninBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  goToSigninText: {
    color: D.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  signinPrompt: {
    textAlign: 'center',
    color: D.textMuted,
    fontSize: 14,
    marginTop: 24,
  },
  signinLink: {
    color: D.accent,
    fontWeight: '700',
  },
  referralValid: {
    color: D.accent,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  referralValidating: {
    color: D.textMuted,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
});

