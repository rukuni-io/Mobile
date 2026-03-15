import React, { useEffect, useRef, useCallback } from 'react';
import { StatusBar, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import { AlertNotificationRoot } from 'react-native-alert-notification';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './context/AuthContext';
import SessionExpiryModal from './components/SessionExpiryModal';

// Auth Screens
import SigninScreen from './screens/auth/SigninScreen';
import SignupScreen from './screens/auth/SignupScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';

// Onboarding Screens
import SplashScreen from './screens/onboarding/SplashScreen';
import OnboardingScreen from './screens/onboarding/OnboardingScreen';

// Main Screens
import DashboardScreen from './screens/main/DashboardScreen';
import ProfileScreen from './screens/main/ProfileScreen';
import SettingsScreen from './screens/main/SettingsScreen';
import ReferralScreen from './screens/main/ReferralScreen';
import SupportScreen from './screens/main/SupportScreen';

// Notification Screens
import NotificationsScreen from './screens/main/notifications/NotificationsScreen';
import NotificationDetailScreen from './screens/main/notifications/NotificationDetailScreen';

// Group Screens
import CreateGroupScreen from './screens/main/groups/CreateGroupScreen';
import GroupDetailsScreen from './screens/main/groups/GroupDetailsScreen';

// Plan Screens
import PlanPickerScreen from './screens/main/PlanPickerScreen';

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Signin: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Dashboard: undefined;
  PlanPicker: undefined;
  CreateGroup: undefined;
  GroupDetails: undefined;
  Notifications: undefined;
  NotificationDetail: { notification_id: string };
  Profile: undefined;
  Referral: undefined;
  Settings: undefined;
  Support: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#00a97b' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: '500' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      text1Style={{ fontSize: 15, fontWeight: '500' }}
      text2Style={{ fontSize: 13 }}
    />
  )
};

// ─── App Content (uses Auth Context) ──────────────────────────────────────────

const AppContent: React.FC = () => {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {
    isAuthenticated,
    showSessionExpiry,
    countdownSeconds,
    refreshToken,
    handleLogout,
    setupExpirationTimer,
    setNavigationRef,
  } = useAuth();

  // Set navigation ref for auth context
  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef.current);
    }
  }, [setNavigationRef]);

  // Handle navigation state changes to setup timer after login
  const onNavigationStateChange = useCallback(async () => {
    const currentRoute = navigationRef.current?.getCurrentRoute()?.name;
    if (currentRoute === 'Dashboard') {
      await setupExpirationTimer();
    }
  }, [setupExpirationTimer]);

  if (isAuthenticated === null) {
    return null; // Optionally, render a loading indicator here
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <NavigationContainer ref={navigationRef} onStateChange={onNavigationStateChange}>
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={isAuthenticated ? "Dashboard" : "Splash"}
          >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Signin" component={SigninScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="PlanPicker"
              component={PlanPickerScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="GroupDetails"
              component={GroupDetailsScreen}
              options={{
                headerShown: false
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: false
              }}
            />
            <Stack.Screen
              name="NotificationDetail"
              component={NotificationDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Referral"
              component={ReferralScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Support"
              component={SupportScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <Toast config={toastConfig} />
      </View>

      {/* Session Expiry Modal */}
      <SessionExpiryModal
        visible={showSessionExpiry}
        countdown={countdownSeconds}
        onStayLoggedIn={async () => { await refreshToken(); }}
        onLogout={() => handleLogout(false)}
      />
    </>
  );
};

// ─── Main App Component ───────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <AlertNotificationRoot>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AlertNotificationRoot>
    </SafeAreaProvider>
  );
}
