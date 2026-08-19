import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import PrimaryButton from '../../components/PrimaryButton';

type RootStackParamList = {
  EmailVerification: { email: string };
  Signin: undefined;
};

type EmailVerificationRouteProp = RouteProp<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<EmailVerificationRouteProp>();

  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const email = route.params?.email || '';
  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleResendEmail = async () => {
    setResendLoading(true);
    try {
      await axios.post(`${apiUrl}/auth/resend-verification`, { email });
      Dialog.show({
        type: ALERT_TYPE.SUCCESS,
        title: 'Email Sent',
        textBody: 'A new verification link has been sent to your email. It expires in 60 minutes.',
        button: 'OK',
      });
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to resend the verification email. Please try again.';
      Dialog.show({ type: ALERT_TYPE.DANGER, title: 'Error', textBody: msg, button: 'OK' });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#003f5c" />
      <LinearGradient colors={['#003f5c', '#1c3c5c']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logos/RUKUNI-LOGO-mobile-18.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.mailIcon}>✉️</Text>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a verification link to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.instructions}>
            Open the email and tap <Text style={styles.email}>Verify Email Address</Text> to finish setting up your account. The link expires in 60 minutes — check your spam folder if you don't see it.
          </Text>

          <PrimaryButton
            label={
              resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : 'Resend Verification Email'
            }
            onPress={handleResendEmail}
            loading={resendLoading}
            disabled={resendLoading || resendCountdown > 0}
            style={styles.button}
          />

          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate('Signin', email ? { email } : undefined);
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </View>
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
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
  },
  mailIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
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
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  email: {
    fontWeight: '600',
    color: '#fff',
  },
  instructions: {
    fontSize: 14,
    color: '#a3c9e3',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  button: {
    marginTop: 28,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
