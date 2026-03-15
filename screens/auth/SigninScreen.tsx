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


type RootStackParamList = {
  Signin: undefined;
  Signup: undefined;
  Dashboard: undefined;
  ForgotPassword: undefined;
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

        // Show plan picker on the first login of each day
        const today = new Date().toISOString().split('T')[0];
        const lastLoginDate = await AsyncStorage.getItem('lastLoginDate');
        await AsyncStorage.setItem('lastLoginDate', today);
        const routeName = lastLoginDate !== today ? 'PlanPicker' : 'Dashboard';
        navigation.reset({ index: 0, routes: [{ name: routeName }] });
      } else {
        Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Sign In Error', textBody: 'Invalid response from server', button: 'Close' });
      }
    } catch (error: any) {
      const errorMessage = error.isAxiosError
        ? error.response?.data?.message || error.response?.data?.error || 'Invalid credentials'
        : error.message || 'Network error. Please check your connection.';
      Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Sign In Error', textBody: errorMessage, button: 'Close' });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={D.bg} />

      {/* Hero gradient banner */}
      <LinearGradient colors={['#1a1f3e', D.bg]} style={styles.heroBanner}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <Text style={styles.heroEmoji}>🔐</Text>
        <Text style={styles.appName}>{Constants.expoConfig?.extra?.appName}</Text>
        <Text style={styles.heroSubtitle}>Sign in to continue</Text>
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
          <Text style={styles.formTitle}>Welcome back 👋</Text>
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

                <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
                  <Text style={styles.googleBtnText}>🌐  Continue with Google</Text>
                </TouchableOpacity>

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
    paddingTop: 60,
    paddingBottom: 36,
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
  cardWrapper: {
    flex: 1,
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
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: D.textPrimary,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: D.textSecondary,
    marginBottom: 24,
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
  googleBtn: {
    height: 50,
    borderRadius: D.radius,
    borderWidth: 1.5,
    borderColor: D.border,
    backgroundColor: D.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  googleBtnText: {
    color: D.textSecondary,
    fontSize: 15,
    fontWeight: '600',
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
