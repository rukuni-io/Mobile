import React from 'react';
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
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { ALERT_TYPE, Dialog } from 'react-native-alert-notification';
import Constants from 'expo-constants';
import { D } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { useAuth } from '../../context/AuthContext';
import { registerPushToken } from '../../utils/registerPushToken';


type RootStackParamList = {
  Signin: undefined;
  Signup: undefined;
  Dashboard: undefined;
  ForgotPassword: undefined;
  EmailVerification: { email: string };
  PlanPicker: undefined;
};

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

const SigninScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setIsAuthenticated, setupExpirationTimer } = useAuth();
  const initialValues = {
    email: '',
    password: '',
  };

  const handleFormSubmit = async (values: typeof initialValues) => {
    const userData = { email: values.email, password: values.password };
    try {
      const apiUrl = Constants.expoConfig?.extra?.apiUrl;
      interface SigninResponse {
        token: string;
        user: any;
        expires_in: number;
      }
      if (!apiUrl) throw new Error('API URL not configured');
      const response = await axios.post<SigninResponse>(`${apiUrl}/auth/login`, userData);
      if (response.data?.token) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        const expiresAt = Date.now() + response.data.expires_in * 1000;
        await AsyncStorage.setItem('tokenExpiresAt', expiresAt.toString());
        
        // Update auth context state
        setIsAuthenticated(true);
        await setupExpirationTimer();

        // Register push token in the background (non-blocking)
        registerPushToken(response.data.token);

        // Check plan from dashboard endpoint (login response doesn't include plan)
        let hasPlan = !!response.data.user?.plan;
        if (!hasPlan) {
          try {
            const dashRes = await axios.get<{ user?: { plan?: string } }>(
              `${apiUrl}/user/dashboard`,
              { headers: { Authorization: `Bearer ${response.data.token}`, Accept: 'application/json' } },
            );
            hasPlan = !!dashRes.data?.user?.plan;
          } catch {
            // If dashboard call fails, default to Dashboard so we don't trap the user
            hasPlan = true;
          }
        }
        const routeName = hasPlan ? 'Dashboard' : 'PlanPicker';
        navigation.reset({ index: 0, routes: [{ name: routeName }] });
      } else {
        Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Sign In Error', textBody: 'Invalid response from server', button: 'Close' });
      }
    } catch (error: any) {
      const errorMessage = error.isAxiosError
        ? error.response?.data?.message || error.response?.data?.error || 'Invalid credentials'
        : error.message || 'Network error. Please check your connection.';
      
      // Check if error is related to email not being verified
      const isEmailNotVerified = 
        errorMessage?.toLowerCase().includes('email') && 
        errorMessage?.toLowerCase().includes('verif');
      
      if (isEmailNotVerified) {
        Dialog.show({
          type: ALERT_TYPE.WARNING,
          title: 'Email Not Verified',
          textBody: 'Please verify your email before signing in.',
          button: 'Verify',
          onHide: () => {
            navigation.navigate('EmailVerification', { email: values.email });
          },
        });
      } else {
        Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Sign In Error', textBody: errorMessage, button: 'Close' });
      }
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Hero gradient banner */}
      <LinearGradient colors={['#141414', D.bg]} style={styles.heroBanner}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <Image
          source={require('../../assets/logos/RUKUNI-LOGO-mobile-18.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />
      </LinearGradient>

      {/* Form card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.cardWrapper}
      >
        <ScrollView
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formTitleRow}>
            <Text style={styles.formTitle}>Welcome back </Text>
            <Text style={styles.formTitleEmoji}>👋</Text>
          </View>
          <Text style={styles.formSubtitle}>Sign in to your account</Text>

          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleFormSubmit}
          >
            {({ handleChange, handleSubmit, values, errors, touched, isSubmitting }) => (
              <>
                <FloatingLabelInput
                  label="Email address"
                  value={values.email}
                  onChangeText={handleChange('email')}
                  iconName="mail-outline"
                  keyboardType="email-address"
                  error={touched.email && errors.email ? errors.email : undefined}
                />
                <FloatingLabelInput
                  label="Password"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  iconName="lock-closed-outline"
                  secureTextEntry
                  secureToggle
                  error={touched.password && errors.password ? errors.password : undefined}
                />

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotRow}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <PrimaryButton
                  label="Sign In"
                  onPress={() => handleSubmit()}
                  loading={isSubmitting}
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Text style={styles.signupPrompt}>
                  Don't have an account?{' '}
                  <Text style={styles.signupLink} onPress={() => navigation.navigate('Signup')}>
                    Sign Up
                  </Text>
                </Text>
              </>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SigninScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  heroBanner: {
    paddingTop: 70,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: {
    width: 130,
    height: 130,
    marginBottom: 12,
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
    backgroundColor: D.accentGlow,
    bottom: 0,
    left: -30,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: D.surfaceCard,
    marginHorizontal: 20,
    borderRadius: D.radiusLg,
    padding: 28,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: D.border,
    borderLeftWidth: 3,
    borderLeftColor: "#ffffff",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: D.textPrimary,
    letterSpacing: -0.5,
  },
  formTitleEmoji: {
    fontSize: 26,
  },
  formSubtitle: {
    fontSize: 14,
    color: D.textSecondary,
    marginBottom: 28,
    letterSpacing: 0.1,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    color: D.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: D.border,
  },
  dividerText: {
    color: D.textMuted,
    fontSize: 13,
  },
  signupPrompt: {
    textAlign: 'center',
    color: D.textMuted,
    fontSize: 14,
  },
  signupLink: {
    color: D.accent,
    fontWeight: '700',
  },
});
